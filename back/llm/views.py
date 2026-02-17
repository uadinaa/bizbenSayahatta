from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .serializers import (
    ChatRequestSerializer,
    TripPlanRequestSerializer,
    ChatThreadCreateSerializer,
    ChatThreadListSerializer,
    ChatThreadDetailSerializer,
    ChatEntrySerializer,
    ChatEntryCreateSerializer,
)
from .models import ChatMessage, ChatThread, ChatEntry
from .services.openai_service import ask_travel_ai, polish_trip_plan
from .services.trip_planner import build_trip_plan
from places.models import Place


MAX_CHAT_CONTEXT_PLACES = 8


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


def _get_top_places_for_city(city: str):
    if not city:
        return []
    return list(
        Place.objects.filter(city__iexact=city)
        .order_by("-is_must_visit", "-rating", "-user_ratings_total")[:MAX_CHAT_CONTEXT_PLACES]
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


class TravelChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user_message = serializer.validated_data["message"]

        detected_city = _detect_city_from_message(user_message)
        source_places = _get_top_places_for_city(detected_city)
        context = _build_places_context_for_city(detected_city)

        ai_response = ask_travel_ai(
            user_message=user_message,
            context=context
        )
        sources_block = _build_sources_block(source_places)
        final_response = f"{ai_response}\n\n{sources_block}"

        ChatMessage.objects.create(
            user=request.user,
            user_message=user_message,
            ai_response=final_response
        )

        return Response(
            {"response": final_response, "sources": [place.name for place in source_places]},
            status=status.HTTP_200_OK
        )


class TravelPlanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        threads = ChatThread.objects.filter(user=request.user).order_by("-updated_at")
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
    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id):
        thread = ChatThread.objects.filter(id=thread_id, user=request.user).first()
        if not thread:
            return Response({"detail": "Thread not found"}, status=404)
        return Response(ChatThreadDetailSerializer(thread).data, status=status.HTTP_200_OK)


class ChatEntryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id):
        thread = ChatThread.objects.filter(id=thread_id, user=request.user).first()
        if not thread:
            return Response({"detail": "Thread not found"}, status=404)
        messages = ChatEntry.objects.filter(thread=thread)
        return Response(ChatEntrySerializer(messages, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, thread_id):
        thread = ChatThread.objects.filter(id=thread_id, user=request.user).first()
        if not thread:
            return Response({"detail": "Thread not found"}, status=404)

        serializer = ChatEntryCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user_message = serializer.validated_data["message"]
        ChatEntry.objects.create(thread=thread, role="user", content=user_message)

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
            context=context
        )
        sources_block = _build_sources_block(source_places)
        final_response = f"{ai_response}\n\n{sources_block}"

        ChatEntry.objects.create(thread=thread, role="assistant", content=final_response)
        thread.save()

        return Response(
            {"response": final_response, "sources": [place.name for place in source_places]},
            status=status.HTTP_200_OK
        )


class ChatThreadPlanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, thread_id):
        thread = ChatThread.objects.filter(id=thread_id, user=request.user).first()
        if not thread:
            return Response({"detail": "Thread not found"}, status=404)

        if thread.kind != "planner":
            return Response({"detail": "Plan generation is only for planner chats."}, status=400)

        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

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

        ChatEntry.objects.create(
            thread=thread,
            role="assistant",
            content=(
                polished_text
                or f"Generated a {plan.get('days_generated', '')}-day plan for {plan.get('city', '')}."
            ),
        )

        return Response(plan, status=status.HTTP_200_OK)
