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
from .services.openai_service import ask_travel_ai
from .services.trip_planner import build_trip_plan


class TravelChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user_message = serializer.validated_data["message"]

        # ⬇️ тут ПОТОМ добавим данные из БД (поездки, города)
        context = ""

        ai_response = ask_travel_ai(
            user_message=user_message,
            context=context
        )

        ChatMessage.objects.create(
            user=request.user,
            user_message=user_message,
            ai_response=ai_response
        )

        return Response(
            {"response": ai_response},
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

        context = ""
        if thread.city or thread.start_date or thread.end_date:
            context = f"Trip context: city={thread.city}, start={thread.start_date}, end={thread.end_date}."

        ai_response = ask_travel_ai(
            user_message=user_message,
            context=context
        )

        ChatEntry.objects.create(thread=thread, role="assistant", content=ai_response)
        thread.save()

        return Response(
            {"response": ai_response},
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

        thread.plan_json = plan
        if data.get("city"):
            thread.city = data.get("city")
        thread.save(update_fields=["plan_json", "city", "updated_at"])

        ChatEntry.objects.create(
            thread=thread,
            role="assistant",
            content=f"Generated a {plan.get('days_generated', '')}-day plan for {plan.get('city', '')}."
        )

        return Response(plan, status=status.HTTP_200_OK)
