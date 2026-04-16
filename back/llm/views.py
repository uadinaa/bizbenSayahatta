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
from .services.openai_service import ask_travel_ai, polish_trip_plan, detect_language
from .services.final_trip import sync_final_trip
from .services.travel_chat import (
    HotelSearchParams,
    build_missing_details_response,
    collect_trip_requirements,
    enrich_thread_plan_for_final_trip,
    extract_hotel_search_params,
    generate_auto_title,
    generate_trip_payload,
    get_missing_requirements,
    strip_trip_sources_from_markdown,
    trip_plan_should_refresh,
)
from .services.trip_planner import build_trip_plan
from places.models import Place
from users.permissions import IsActiveAndNotBlocked
from users.models import UserPreferences
from users.services import sync_user_travel_profile
from .services.hotel_cache import get_hotels_cached
from .services.tripadvisor_service import get_tours_cached

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


def _build_hotel_context_block(hotels: list, search_params: HotelSearchParams) -> str:
    """
    Build a formatted hotel context block for LLM injection.

    Format:
    HOTEL OPTIONS FOR {CITY} ({CHECKIN} to {CHECKOUT}):
    Budget: ${price_min}-${price_max}/night

    Option 1: {name} — ${price}/night — ⭐{rating}/10
      Address: {address} | {distance_to_center_km}km from center
      Highlights: {highlights joined by ", "}
      Cancellation: {cancellation_policy}
      Book: {booking_url}
    """
    if not hotels:
        return ""

    lines = []
    city = search_params.city or "Unknown city"
    checkin = search_params.checkin or "TBD"
    checkout = search_params.checkout or "TBD"
    budget = search_params.budget_per_night or 100

    lines.append(f"HOTEL OPTIONS FOR {city} ({checkin} to {checkout}):")
    lines.append(f"Budget: ${int(budget * 0.4)}-${int(budget * 0.9)}/night")
    lines.append("")

    for i, hotel in enumerate(hotels[:5], 1):
        name = hotel.get("name", "Unknown Hotel")
        price = hotel.get("price_per_night", 0)
        rating = hotel.get("rating", 0)
        address = hotel.get("address", "Address not available")
        distance = hotel.get("distance_to_center_km", 0)
        highlights = hotel.get("highlights", [])
        cancellation = hotel.get("cancellation_policy", "Contact for details")
        # Build booking URL with dates for real-time availability
        booking_url = hotel.get("booking_url", "")
        if not booking_url and name:
            from .services.booking_service import _build_booking_url
            booking_url = _build_booking_url(
                hotel.get("id", ""),
                name,
                checkin=search_params.checkin,
                checkout=search_params.checkout,
            )

        highlights_str = ", ".join(highlights) if highlights else "No specific highlights"

        lines.append(f"Option {i}: {name} — ${price}/night — ⭐{rating}/10")
        lines.append(f"  Address: {address} | {distance}km from center")
        lines.append(f"  Highlights: {highlights_str}")
        lines.append(f"  Cancellation: {cancellation}")
        lines.append(f"  Book: {booking_url}")
        lines.append("")

    lines.append("(max 5 hotels shown)")
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

    should_generate_trip = not missing and (
        not thread.plan_json
        or trip_plan_should_refresh(thread, requirements, message)
    )

    if missing and (previous_user_count == 0 or not thread.plan_json):
        return {
            "response": build_missing_details_response(missing),
            "plan": thread.plan_json,
            "sources": [],
        }

    if should_generate_trip:
        try:
            payload = generate_trip_payload(
                user=user, requirements=requirements, thread=thread
            )
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

        # Generate auto title if thread doesn't have one or still uses default
        should_update_title = (
            thread.auto_title or
            not thread.title or
            thread.title == "New chat" or
            thread.title == f"{thread.city} trip"
        )

        thread.plan_json = payload
        thread.city = payload.get("city") or thread.city

        if should_update_title:
            city = payload.get("city") or requirements.destination or thread.city
            travelers = payload.get("travelers") or requirements.travelers
            traveler_type = payload.get("traveler_type") or requirements.traveler_type
            new_title = generate_auto_title(city, travelers, traveler_type)
            thread.title = new_title

        thread.save(update_fields=["plan_json", "city", "title", "updated_at"])
        sync_final_trip(thread, payload)
        full_md = payload["response_markdown"]
        sources_already = ChatEntry.objects.filter(
            thread=thread,
            role="assistant",
            content__contains="## 📚 Sources",
        ).exists()
        chat_md = (
            strip_trip_sources_from_markdown(full_md) if sources_already else full_md
        )
        return {
            "response": chat_md,
            "plan": payload,
            "sources": [item["label"] for item in payload["sources"]["items"]],
            "thread": {
                "id": thread.id,
                "title": thread.title,
                "auto_title": thread.auto_title,
            },
        }

    return None


def _get_hotel_context_for_chat(user_message: str, thread=None, user=None) -> str:
    """
    Fetch hotel context for the chat based on user message.
    Returns formatted hotel block or empty string if no hotels found.
    """

    # Build fallback context from thread or user profile
    fallback_city = ""
    fallback_budget = None
    fallback_duration = None

    if thread:
        fallback_city = thread.city or ""
        if thread.plan_json:
            fallback_duration = thread.plan_json.get("days_requested") or thread.plan_json.get("days_generated")

    if user and hasattr(user, "preferences"):
        fallback_budget = user.preferences.budget if user.preferences.budget else None

    # Extract hotel search params from message
    search_params = extract_hotel_search_params(
        user_message=user_message,
        user_profile={"travel_style": getattr(user.preferences, "travel_style", "") if user and hasattr(user, "preferences") else {}},
        fallback_city=fallback_city,
        fallback_budget=fallback_budget,
        fallback_duration=fallback_duration,
    )

    # Need at least city and dates to search hotels
    if not search_params.city or not search_params.checkin or not search_params.checkout:
        return ""

    # Fetch hotels (uses cache if available)
    hotels = get_hotels_cached(
        city_name=search_params.city,
        checkin=search_params.checkin,
        checkout=search_params.checkout,
        budget_per_night=search_params.budget_per_night or 100,
        adults=search_params.adults or 1,
        children=search_params.children or 0,
        travel_style=search_params.travel_style,
    )

    if hotels:
        return _build_hotel_context_block(hotels, search_params)

    return ""


def _get_tour_context_for_chat(city: str) -> str:
    """
    Fetch tour/attraction context from TripAdvisor based on city.
    Returns formatted tour block or empty string if no tours found.

    Args:
        city: Destination city name

    Returns:
        Formatted string with tour information for LLM context
    """
    if not city:
        return ""

    # Fetch tours from TripAdvisor (uses cache internally)
    tours = get_tours_cached(city, max_results=10)

    if not tours:
        return ""

    lines = []
    lines.append(f"TOURS & ATTRACTIONS FOR {city.upper()}:")
    lines.append("")

    for i, tour in enumerate(tours[:5], 1):
        name = tour.get("name", "Unknown Attraction")
        category = tour.get("category") or tour.get("subcategory", "Attraction")
        rating = tour.get("rating", 0)
        num_reviews = tour.get("num_reviews", 0)
        price_amount = tour.get("price_amount")
        price_currency = tour.get("price_currency", "USD")
        photo_url = tour.get("photo_url", "")
        web_url = tour.get("web_url", "")
        duration = tour.get("duration", "")

        lines.append(f"Option {i}: {name} ({category})")
        if rating:
            lines.append(f"  Rating: {rating}/10 ({num_reviews} reviews)")
        if price_amount:
            lines.append(f"  Price: {price_currency} {price_amount}")
        if duration:
            lines.append(f"  Duration: {duration}")
        if web_url:
            lines.append(f"  Book: {web_url}")
        lines.append("")

    lines.append("(max 5 tours shown)")
    return "\n".join(lines)


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
        places_context = _build_places_context_for_city(detected_city)
        hotel_context = _get_hotel_context_for_chat(user_message, user=request.user)
        tour_context = _get_tour_context_for_chat(detected_city)

        # Build combined context from all sources
        context = "\n\n".join(
            part for part in [places_context, hotel_context, tour_context] if part
        )

        # Detect language from user message
        language = detect_language(user_message)

        ai_response = ask_travel_ai(
            user_message=user_message,
            context=context,
            language=language,
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
        travelers = data.get("travelers")
        traveler_type = data.get("traveler_type") or ""

        if not title:
            if city:
                # Use new auto-title format: city_travelers
                title = generate_auto_title(city, travelers, traveler_type)
            else:
                title = "New chat"

        thread = ChatThread.objects.create(
            user=request.user,
            kind=kind,
            title=title,
            city=city,
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            auto_title=True,  # Mark as auto-generated
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

    def patch(self, request, thread_id):
        # Update thread title (user-edited)
        thread, error_response = _get_thread_for_request(request, thread_id)
        if error_response:
            return error_response

        title = request.data.get("title", "").strip()
        if not title:
            return Response({"detail": "Title cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        if len(title) > 100:
            return Response({"detail": "Title cannot exceed 100 characters."}, status=status.HTTP_400_BAD_REQUEST)

        thread.title = title
        thread.auto_title = False  # Disable auto-title when user edits manually
        thread.save(update_fields=["title", "auto_title", "updated_at"])

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
            response_data = {
                "response": trip_result["response"],
                "sources": trip_result["sources"],
                "tokens_left": request.user.tokens,
                "plan": trip_result["plan"],
            }
            if "thread" in trip_result:
                response_data["thread"] = trip_result["thread"]
            return Response(response_data, status=status.HTTP_200_OK)

        selected_city = _detect_city_from_message(user_message, fallback_city=thread.city or "")
        source_places = _get_top_places_for_city(selected_city)
        places_context = _build_places_context_for_city(selected_city)
        hotel_context = _get_hotel_context_for_chat(user_message, thread=thread, user=request.user)
        tour_context = _get_tour_context_for_chat(selected_city)
        trip_context = ""
        if thread.city or thread.start_date or thread.end_date:
            trip_context = (
                f"Trip context: city={thread.city}, start={thread.start_date}, end={thread.end_date}."
            )
        context = "\n\n".join(
            part for part in [trip_context, places_context, hotel_context, tour_context] if part
        )

        # Detect language from user message
        language = detect_language(user_message)

        ai_response = ask_travel_ai(
            user_message=user_message,
            context=context,
            history=_recent_history_text(thread),
            language=language,
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

        full_plan = enrich_thread_plan_for_final_trip(user=request.user, thread=thread, plan=plan)
        thread.plan_json = full_plan
        if data.get("city"):
            thread.city = data.get("city")
        thread.save(update_fields=["plan_json", "city", "updated_at"])
        sync_final_trip(thread, full_plan)

        ChatEntry.objects.create(
            thread=thread,
            role="assistant",
            content=(
                polished_text
                or f"Generated a {full_plan.get('days_generated', '')}-day plan for {full_plan.get('city', '')}."
            ),
        )

        return Response(full_plan, status=status.HTTP_200_OK)


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
