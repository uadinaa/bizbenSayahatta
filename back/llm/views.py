from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import F

from .serializers import (
    ChatRequestSerializer,
    TripPlanRequestSerializer,
    ChatThreadCreateSerializer,
    ChatThreadListSerializer,
    ChatThreadDetailSerializer,
    ChatEntrySerializer,
    ChatEntryCreateSerializer,
    FinalTripSerializer,
    FinalTripUpdateSerializer,
)
from .models import ChatMessage, ChatThread, ChatEntry, FinalTrip
from .services.openai_service import ask_travel_ai, polish_trip_plan
from .services.final_trip import sync_final_trip
from .services.travel_chat import (
    build_missing_details_response,
    collect_trip_requirements,
    generate_trip_payload,
    get_missing_requirements,
)
from .services.trip_planner import build_trip_plan
from places.models import Place
from users.permissions import IsActiveAndNotBlocked
from users.models import UserPreferences
from users.services import sync_user_travel_profile


MAX_CHAT_CONTEXT_PLACES = 8
TOKENS_PER_CHAT = 1
TOKENS_PER_PLAN = 2


def _ensure_advanced_ai_access(user):
    if user.role == "TRIPADVISOR" and user.subscription_status != "ACTIVE":
        return Response(
            {"detail": "Active subscription is required for advanced AI planning."},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )
    return None


def _consume_tokens_or_respond(user, amount: int):
    if user.tokens < amount:
        return Response(
            {"detail": "Not enough tokens.", "required": amount, "tokens": user.tokens},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )
    type(user).objects.filter(id=user.id).update(tokens=F("tokens") - amount)
    user.refresh_from_db(fields=["tokens"])
    return None


def _detect_city_from_message(message: str, fallback_city: str = "") -> str:
    text = (message or "").lower()
    if not text:
        return fallback_city or ""

    candidate_cities = (
        Place.objects.exclude(city__isnull=True)
        .exclude(city__exact="")
        .values_list("city", flat=True)
        .distinct()
    )
    # Longest-first helps avoid partial collisions (e.g. "York" vs "New York").
    ordered = sorted(set(candidate_cities), key=lambda value: len(value), reverse=True)
    for city in ordered:
        if city.lower() in text:
            return city
    return fallback_city or ""


def _get_thread_for_request(request, thread_id: int):
    # Enforce thread ownership before any thread action.
    thread = ChatThread.objects.filter(id=thread_id).first()
    if not thread:
        return None, Response({"detail": "Thread not found"}, status=status.HTTP_404_NOT_FOUND)
    if thread.user_id != request.user.id:
        return None, Response({"detail": "You do not have permission to access this chat."}, status=status.HTTP_403_FORBIDDEN)
    return thread, None


def _get_top_places_for_city(city: str):
    if not city:
        return []
    return list(
        Place.objects.filter(city__iexact=city)
        .order_by("-rating", "-user_ratings_total")[:MAX_CHAT_CONTEXT_PLACES]
    )


def _build_sources_block(places) -> str:
    if not places:
        return "Sources:\n- No cached places found for this city."
    lines = ["Sources:"]
    for place in places:
        lines.append(f"- {place.name} ({place.category})")
    return "\n".join(lines)


def _build_places_context_for_city(city: str) -> str:
    if not city:
        return ""

    places = _get_top_places_for_city(city)
    if not places:
        return (
            f"Grounded city: {city}\n"
            "No cached places found for this city in DB.\n"
            "Do not invent places. Ask user to refresh cache or choose another city."
        )

    lines = [
        "You must ground recommendations only on cached places below.",
        "If the user asks for places outside this list, say that cached data is limited.",
        f"Grounded city: {city}",
        "Cached places:",
    ]
    for place in places:
        lines.append(
            (
                f"- {place.name} | category={place.category} | rating={place.rating or 'n/a'} | "
                f"address={place.address}"
            )
        )
    return "\n".join(lines)


def _recent_history_text(thread) -> str:
    entries = list(ChatEntry.objects.filter(thread=thread).order_by("created_at")[:10])
    return "\n".join(f"{entry.role}: {entry.content}" for entry in entries[-6:])


def _generate_thread_trip_response(thread, user, message: str):
    UserPreferences.objects.get_or_create(user=user)
    sync_user_travel_profile(user)

    previous_user_count = ChatEntry.objects.filter(thread=thread, role="user").count() - 1
    all_user_text = "\n".join(
        ChatEntry.objects.filter(thread=thread, role="user")
        .order_by("created_at")
        .values_list("content", flat=True)
    )
    requirements = collect_trip_requirements(
        text=all_user_text,
        fallback_city=thread.city or "",
        fallback_style=(user.preferences.travel_style or ""),
        fallback_citizenship=(user.preferences.citizenship or ""),
    )
    missing = get_missing_requirements(requirements)

    should_generate_trip = (
        not thread.plan_json
        and not missing
    ) or (
        not missing
        and any(keyword in message.lower() for keyword in {"regenerate", "rebuild", "update trip", "new trip"})
    )

    if missing and (previous_user_count == 0 or not thread.plan_json):
        return {
            "response": build_missing_details_response(missing),
            "plan": thread.plan_json,
            "sources": [],
        }

    if should_generate_trip:
        try:
            payload = generate_trip_payload(user=user, requirements=requirements)
        except ValueError as exc:
            if str(exc) == "no_places_for_city":
                return {
                    "response": (
                        f"I couldn't find cached places for {requirements.destination or 'that destination'} yet. "
                        "Try another city or refresh the place cache first."
                    ),
                    "plan": thread.plan_json,
                    "sources": [],
                }
            raise
        thread.plan_json = payload
        thread.city = payload.get("city") or thread.city
        thread.save(update_fields=["plan_json", "city", "updated_at"])
        sync_final_trip(thread, payload)
        return {
            "response": payload["response_markdown"],
            "plan": payload,
            "sources": [item["label"] for item in payload["sources"]["items"]],
        }

    return None


class TravelChatView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request):
        UserPreferences.objects.get_or_create(user=request.user)
        sync_user_travel_profile(request.user)
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        not_enough = _consume_tokens_or_respond(request.user, TOKENS_PER_CHAT)
        if not_enough:
            return not_enough

        user_message = serializer.validated_data["message"]

        detected_city = _detect_city_from_message(user_message)
        source_places = _get_top_places_for_city(detected_city)
        context = _build_places_context_for_city(detected_city)

        ai_response = ask_travel_ai(
            user_message=user_message,
            context=context,
        )
        sources_block = _build_sources_block(source_places)
        final_response = f"{ai_response}\n\n{sources_block}"

        ChatMessage.objects.create(
            user=request.user,
            user_message=user_message,
            ai_response=final_response
        )

        return Response(
            {"response": final_response, "sources": [place.name for place in source_places], "tokens_left": request.user.tokens},
            status=status.HTTP_200_OK
        )


class TravelPlanView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request):
        blocked = _ensure_advanced_ai_access(request.user)
        if blocked:
            return blocked
        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        not_enough = _consume_tokens_or_respond(request.user, TOKENS_PER_PLAN)
        if not_enough:
            return not_enough

        data = serializer.validated_data
        try:
            plan = build_trip_plan(user=request.user, **data)
        except ValueError as exc:
            if str(exc) == "no_places_for_city":
                return Response(
                    {"detail": "No cached places found for this city."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            raise

        try:
            plan["ai_polish"] = polish_trip_plan(plan)
        except Exception:
            # Keep the structured response available even if LLM polish fails.
            plan["ai_polish"] = ""

        return Response(plan, status=status.HTTP_200_OK)


class ChatThreadListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        archived = request.query_params.get("archived")
        threads = ChatThread.objects.filter(user=request.user)
        if archived == "true":
            threads = threads.filter(is_archived=True)
        else:
            threads = threads.filter(is_archived=False)
        threads = threads.order_by("-updated_at")
        serializer = ChatThreadListSerializer(threads, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ChatThreadCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        title = data.get("title") or ""
        city = data.get("city") or ""
        kind = data["kind"]

        if not title:
            if city:
                title = f"{city} trip" if kind == "planner" else f"{city} chat"
            else:
                title = "New chat"

        thread = ChatThread.objects.create(
            user=request.user,
            kind=kind,
            title=title,
            city=city,
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
        )

        return Response(
            ChatThreadDetailSerializer(thread).data,
            status=status.HTTP_201_CREATED,
        )


class ChatThreadDetailView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request, thread_id):
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response
        return Response(ChatThreadDetailSerializer(thread).data, status=status.HTTP_200_OK)

    def delete(self, request, thread_id):
        # Delete the chat and all related messages/trip data.
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response
        thread.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatEntryListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request, thread_id):
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response
        messages = ChatEntry.objects.filter(thread=thread)
        return Response(ChatEntrySerializer(messages, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, thread_id):
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response

        serializer = ChatEntryCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        not_enough = _consume_tokens_or_respond(request.user, TOKENS_PER_CHAT)
        if not_enough:
            return not_enough

        user_message = serializer.validated_data["message"]
        ChatEntry.objects.create(thread=thread, role="user", content=user_message)

        trip_result = _generate_thread_trip_response(thread, request.user, user_message)
        if trip_result is not None:
            ChatEntry.objects.create(
                thread=thread,
                role="assistant",
                content=trip_result["response"],
            )
            return Response(
                {
                    "response": trip_result["response"],
                    "sources": trip_result["sources"],
                    "tokens_left": request.user.tokens,
                    "plan": trip_result["plan"],
                },
                status=status.HTTP_200_OK,
            )

        selected_city = _detect_city_from_message(user_message, fallback_city=thread.city or "")
        source_places = _get_top_places_for_city(selected_city)
        places_context = _build_places_context_for_city(selected_city)
        trip_context = ""
        if thread.city or thread.start_date or thread.end_date:
            trip_context = (
                f"Trip context: city={thread.city}, start={thread.start_date}, end={thread.end_date}."
            )
        context = "\n\n".join(
            part for part in [trip_context, places_context] if part
        )

        ai_response = ask_travel_ai(
            user_message=user_message,
            context=context,
            history=_recent_history_text(thread),
        )
        sources_block = _build_sources_block(source_places)
        final_response = f"{ai_response}\n\n{sources_block}"

        ChatEntry.objects.create(thread=thread, role="assistant", content=final_response)
        thread.save(update_fields=["updated_at"])

        return Response(
            {
                "response": final_response,
                "sources": [place.name for place in source_places],
                "tokens_left": request.user.tokens,
                "plan": thread.plan_json,
            },
            status=status.HTTP_200_OK
        )


class ChatThreadPlanView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, thread_id):
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response

        if thread.kind != "planner":
            return Response({"detail": "Plan generation is only for planner chats."}, status=400)

        blocked = _ensure_advanced_ai_access(request.user)
        if blocked:
            return blocked

        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        not_enough = _consume_tokens_or_respond(request.user, TOKENS_PER_PLAN)
        if not_enough:
            return not_enough

        data = serializer.validated_data
        try:
            plan = build_trip_plan(user=request.user, **data)
        except ValueError as exc:
            if str(exc) == "no_places_for_city":
                return Response(
                    {"detail": "No cached places found for this city."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            raise

        polished_text = ""
        try:
            polished_text = polish_trip_plan(plan)
            plan["ai_polish"] = polished_text
        except Exception:
            plan["ai_polish"] = ""

        thread.plan_json = plan
        if data.get("city"):
            thread.city = data.get("city")
        thread.save(update_fields=["plan_json", "city", "updated_at"])
        sync_final_trip(thread, plan)

        ChatEntry.objects.create(
            thread=thread,
            role="assistant",
            content=(
                polished_text
                or f"Generated a {plan.get('days_generated', '')}-day plan for {plan.get('city', '')}."
            ),
        )

        return Response(plan, status=status.HTTP_200_OK)


class ChatThreadArchiveView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def patch(self, request, thread_id):
        # Toggle archived state for the selected chat.
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response

        thread.is_archived = not thread.is_archived
        thread.save(update_fields=["is_archived", "updated_at"])
        return Response(
            {
                "id": thread.id,
                "is_archived": thread.is_archived,
            },
            status=status.HTTP_200_OK,
        )


class ChatThreadTripView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request, thread_id):
        # Return the persisted final trip or null for this chat.
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response

        final_trip = FinalTrip.objects.filter(thread=thread).first()
        if not final_trip:
            return Response(None, status=status.HTTP_200_OK)
        return Response(FinalTripSerializer(final_trip).data, status=status.HTTP_200_OK)

    def patch(self, request, thread_id):
        # Update or create the persisted final trip for this chat.
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response

        serializer = FinalTripUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        final_trip, _ = FinalTrip.objects.get_or_create(
            thread=thread,
            defaults={
                "city": thread.city or "",
                "country": "",
                "itinerary": [],
                "route": [],
                "plan_snapshot": thread.plan_json or {},
                "response_markdown": "",
            },
        )

        update_data = serializer.validated_data
        for field, value in update_data.items():
            setattr(final_trip, field, value)

        plan_snapshot = dict(final_trip.plan_snapshot or thread.plan_json or {})
        if "city" in update_data:
            plan_snapshot["city"] = final_trip.city
        if "country" in update_data:
            plan_snapshot["country"] = final_trip.country
        if "itinerary" in update_data:
            plan_snapshot["itinerary"] = final_trip.itinerary
        if "route" in update_data:
            plan_snapshot["route"] = final_trip.route
        if "response_markdown" in update_data:
            plan_snapshot["response_markdown"] = final_trip.response_markdown
        final_trip.plan_snapshot = plan_snapshot
        final_trip.save()

        if plan_snapshot:
            thread.plan_json = plan_snapshot
            if final_trip.city:
                thread.city = final_trip.city
            thread.save(update_fields=["plan_json", "city", "updated_at"])

        return Response(FinalTripSerializer(final_trip).data, status=status.HTTP_200_OK)
