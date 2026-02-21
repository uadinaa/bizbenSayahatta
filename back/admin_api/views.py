from django.utils import timezone
from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import (
    ListAPIView,
    ListCreateAPIView,
    RetrieveAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.pagination import PageNumberPagination

from django.contrib.auth import get_user_model
from places.models import SavedPlace, VisitedPlace, InterestMapping
from llm.models import ChatThread, ChatMessage

from .permissions import IsAdminUser
from .throttling import AdminSensitiveOperationThrottle
from .utils import log_admin_action
from .serializers import (
    AdminUserListSerializer,
    AdminUserDetailSerializer,
    AdminUserBlockSerializer,
    AdminWishlistSerializer,
    AdminVisitedPlaceSerializer,
    AdminChatThreadSerializer,
    AdminChatMessageSerializer,
    AdminInterestMappingSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class AdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

class AdminUserListAPIView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminUserListSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = User.objects.all().order_by("-date_joined")
        include_deleted = self.request.query_params.get("include_deleted", "").lower() in ("1", "true", "yes")
        if not include_deleted:
            qs = qs.filter(deleted_at__isnull=True)
        return qs


class AdminUserDetailAPIView(RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminUserDetailSerializer
    queryset = User.objects.all()
    lookup_url_kwarg = "user_id"
    lookup_field = "id"


class AdminUserBlockAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    throttle_classes = [AdminSensitiveOperationThrottle]

    def patch(self, request, user_id):
        target = User.objects.filter(id=user_id, deleted_at__isnull=True).first()
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = AdminUserBlockSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        target.is_active = ser.validated_data["is_active"]
        target.save(update_fields=["is_active"])
        action = "user.unblock" if target.is_active else "user.block"
        log_admin_action(
            request.user,
            action,
            target_type="user",
            target_id=target.id,
            metadata={"is_active": target.is_active},
        )
        return Response(AdminUserDetailSerializer(target).data, status=status.HTTP_200_OK)


class AdminUserDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    throttle_classes = [AdminSensitiveOperationThrottle]

    def delete(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if target.deleted_at:
            return Response({"detail": "User is already deleted."}, status=status.HTTP_400_BAD_REQUEST)
        if target.id == request.user.id:
            return Response({"detail": "Cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        target.deleted_at = now
        target.is_active = False
        target.save(update_fields=["deleted_at", "is_active"])
        log_admin_action(
            request.user,
            "user.delete",
            target_type="user",
            target_id=target.id,
            metadata={"email": target.email},
        )
        return Response({"detail": "User soft-deleted."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Content moderation: wishlists (SavedPlace)
# ---------------------------------------------------------------------------

class AdminWishlistListAPIView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminWishlistSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = SavedPlace.objects.select_related("user", "place").order_by("-created_at")
        user_id = self.request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class AdminWishlistDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    throttle_classes = [AdminSensitiveOperationThrottle]

    def delete(self, request, pk):
        obj = SavedPlace.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Wishlist record not found."}, status=status.HTTP_404_NOT_FOUND)
        user_id = obj.user_id
        place_id = obj.place_id
        obj.delete()
        log_admin_action(
            request.user,
            "content.delete_wishlist",
            target_type="saved_place",
            target_id=pk,
            metadata={"user_id": user_id, "place_id": place_id},
        )
        return Response({"detail": "Wishlist record deleted."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Content moderation: visited places
# ---------------------------------------------------------------------------

class AdminVisitedPlaceListAPIView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminVisitedPlaceSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = VisitedPlace.objects.select_related("user", "place").order_by("-created_at")
        user_id = self.request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class AdminVisitedPlaceDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    throttle_classes = [AdminSensitiveOperationThrottle]

    def delete(self, request, pk):
        obj = VisitedPlace.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Visited place record not found."}, status=status.HTTP_404_NOT_FOUND)
        user_id = obj.user_id
        place_id = obj.place_id
        obj.delete()
        log_admin_action(
            request.user,
            "content.delete_visited_place",
            target_type="visited_place",
            target_id=pk,
            metadata={"user_id": user_id, "place_id": place_id},
        )
        return Response({"detail": "Visited place record deleted."}, status=status.HTTP_200_OK)


class AdminVisitedCountriesAPIView(APIView):
    """List users' visited countries (aggregate). Optional user_id to filter by user."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from places.models import VisitedPlace
        from django.db.models import Count

        user_id = request.query_params.get("user_id")
        qs = (
            VisitedPlace.objects.values("place__country")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        if user_id:
            qs = qs.filter(user_id=user_id)
        qs = qs.filter(place__country__isnull=False).exclude(place__country="")
        results = [{"country": r["place__country"], "count": r["count"]} for r in qs]
        return Response({"results": results}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Content moderation: threads (trips)
# ---------------------------------------------------------------------------

class AdminThreadListAPIView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminChatThreadSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = ChatThread.objects.select_related("user").order_by("-created_at")
        user_id = self.request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class AdminThreadDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    throttle_classes = [AdminSensitiveOperationThrottle]

    def delete(self, request, pk):
        obj = ChatThread.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Thread not found."}, status=status.HTTP_404_NOT_FOUND)
        user_id = obj.user_id
        obj.delete()
        log_admin_action(
            request.user,
            "content.delete_thread",
            target_type="chat_thread",
            target_id=pk,
            metadata={"user_id": user_id},
        )
        return Response({"detail": "Thread deleted."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Content moderation: chat messages
# ---------------------------------------------------------------------------

class AdminChatMessageListAPIView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminChatMessageSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = ChatMessage.objects.select_related("user").order_by("-created_at")
        user_id = self.request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class AdminChatMessageDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    throttle_classes = [AdminSensitiveOperationThrottle]

    def delete(self, request, pk):
        obj = ChatMessage.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Chat message not found."}, status=status.HTTP_404_NOT_FOUND)
        user_id = obj.user_id
        obj.delete()
        log_admin_action(
            request.user,
            "content.delete_chat_message",
            target_type="chat_message",
            target_id=pk,
            metadata={"user_id": user_id},
        )
        return Response({"detail": "Chat message deleted."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Reference data: InterestMapping
# ---------------------------------------------------------------------------

class AdminInterestMappingListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminInterestMappingSerializer
    pagination_class = AdminPagination
    queryset = InterestMapping.objects.all().order_by("name")

    def get_throttle_classes(self):
        if self.request.method == "POST":
            return [AdminSensitiveOperationThrottle]
        return []

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            "reference.create",
            target_type="interest_mapping",
            target_id=instance.id,
            metadata={"name": instance.name},
        )


class AdminInterestMappingDetailAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminInterestMappingSerializer
    queryset = InterestMapping.objects.all()

    def get_throttle_classes(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [AdminSensitiveOperationThrottle]
        return []

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            "reference.update",
            target_type="interest_mapping",
            target_id=instance.id,
            metadata={"name": instance.name},
        )

    def perform_destroy(self, instance):
        pk = instance.id
        name = instance.name
        instance.delete()
        log_admin_action(
            self.request.user,
            "reference.delete",
            target_type="interest_mapping",
            target_id=pk,
            metadata={"name": name},
        )


# ---------------------------------------------------------------------------
# Audit log (read-only for admins)
# ---------------------------------------------------------------------------

class AdminAuditLogListAPIView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = AdminPagination

    def get_queryset(self):
        from admin_api.models import AdminAuditLog
        return AdminAuditLog.objects.select_related("admin").order_by("-created_at")

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        def _log_data(log):
            return {
                "id": log.id,
                "admin_id": log.admin_id,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "metadata": log.metadata,
                "created_at": log.created_at,
            }
        if page is not None:
            return self.get_paginated_response([_log_data(log) for log in page])
        return Response([_log_data(log) for log in qs])
