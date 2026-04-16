from django.db import IntegrityError, transaction
from django.db.models import BooleanField, Exists, F, OuterRef, Q, Value
from django.db.models.functions import Greatest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from llm.models import ChatThread
from places.models import Place
from users.models import User
from users.permissions import IsActiveAndNotBlocked

from .models import (
    AdvisorCategory,
    TripAdvisorApplication,
    TripAdvisorProfile,
    Trip,
    TripBooking,
    TripMedia,
    TripVersion,
    Comment,
    CommentLike,
    WishlistFolder,
    WishlistItem,
    UserRestriction,
    ModerationLog,
    SubscriptionEvent,
    SavedTrip,
)
from .permissions import IsAdminRole, IsManagerRole, IsTripAdvisorRole
from .serializers import (
    AdvisorCategorySerializer,
    TripAdvisorApplicationCreateSerializer,
    TripAdvisorApplicationSerializer,
    TripAdvisorApplicationManagerSerializer,
    TripAdvisorApplicationReviewSerializer,
    TripAdvisorProfileSerializer,
    TripAdvisorProfileUpdateSerializer,
    TripSerializer,
    TripUpdateSerializer,
    TripModerationSerializer,
    TripVersionSerializer,
    TripMediaSerializer,
    TripBookingSerializer,
    TripBookingCreateSerializer,
    CommentSerializer,
    WishlistFolderSerializer,
    WishlistItemSerializer,
    UserRestrictionSerializer,
    ModerationLogSerializer,
)
from .services.audit import log_action
from .services.ranking import refresh_profile_ranking
from .services.trips import create_trip_version, submit_trip_for_moderation, approve_trip, reject_trip
from .services.bookings import book_trip, cancel_booking, confirm_booking, get_user_bookings, get_trip_bookings


class AdvisorCategoryListView(ListAPIView):
    queryset = AdvisorCategory.objects.filter(is_active=True)
    serializer_class = AdvisorCategorySerializer


class TripAdvisorApplyView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request):
        user = request.user
        if user.role not in {User.Role.USER, User.Role.TRIPADVISOR}:
            return Response({"detail": "Only regular users can apply."}, status=status.HTTP_403_FORBIDDEN)

        serializer = TripAdvisorApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        existing = TripAdvisorApplication.objects.filter(user=user, status=TripAdvisorApplication.STATUS_PENDING).first()
        if existing:
            return Response({"detail": "Application already pending."}, status=status.HTTP_400_BAD_REQUEST)

        app = TripAdvisorApplication.objects.create(
            user=user,
            contract_accepted=serializer.validated_data["contract_accepted"],
            terms_accepted=serializer.validated_data["terms_accepted"],
            subscription_plan=serializer.validated_data.get("subscription_plan", ""),
            payment_reference=serializer.validated_data.get("payment_reference", ""),
            cv_file=serializer.validated_data.get("cv_file"),
            portfolio_links=serializer.validated_data.get("portfolio_links", []),
            notes=serializer.validated_data.get("notes", ""),
            status=TripAdvisorApplication.STATUS_PENDING,
        )

        category_ids = serializer.validated_data.get("category_ids", [])
        if category_ids:
            profile, _ = TripAdvisorProfile.objects.get_or_create(user=user)
            profile.categories.set(AdvisorCategory.objects.filter(id__in=category_ids, is_active=True))

        log_action(actor=user, action="advisor.application.submitted", application=app)
        return Response(TripAdvisorApplicationSerializer(app).data, status=status.HTTP_201_CREATED)


class MyTripAdvisorApplicationsView(ListAPIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]
    serializer_class = TripAdvisorApplicationSerializer

    def get_queryset(self):
        return TripAdvisorApplication.objects.filter(user=self.request.user).order_by("-created_at")


class TripAdvisorProfileView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        profile, _ = TripAdvisorProfile.objects.get_or_create(user=request.user)
        return Response(TripAdvisorProfileSerializer(profile).data, status=status.HTTP_200_OK)

    def patch(self, request):
        if request.user.role not in {User.Role.TRIPADVISOR, User.Role.ADMIN}:
            return Response({"detail": "Only TripAdvisor accounts can edit advisor profile."}, status=status.HTTP_403_FORBIDDEN)

        profile, _ = TripAdvisorProfile.objects.get_or_create(user=request.user)
        serializer = TripAdvisorProfileUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        changed_fields = []
        if "description" in serializer.validated_data:
            profile.description = serializer.validated_data["description"]
            changed_fields.append("description")
        if "social_links" in serializer.validated_data:
            profile.social_links = serializer.validated_data["social_links"]
            changed_fields.append("social_links")
        if changed_fields:
            changed_fields.append("updated_at")
            profile.save(update_fields=changed_fields)

        if "category_ids" in serializer.validated_data:
            profile.categories.set(AdvisorCategory.objects.filter(id__in=serializer.validated_data["category_ids"], is_active=True))

        refresh_profile_ranking(profile)
        return Response(TripAdvisorProfileSerializer(profile).data, status=status.HTTP_200_OK)


class AdvisorTripListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]

    def get(self, request):
        tab = request.query_params.get("tab", "recommended")
        qs = Trip.objects.select_related("advisor", "category")

        if tab == "my":
            qs = qs.filter(advisor=request.user)
        elif tab == "top-rated":
            qs = qs.filter(status=Trip.STATUS_APPROVED, visibility=Trip.VISIBILITY_PUBLIC).order_by("-rating", "-review_count")
        elif tab == "categories":
            category = request.query_params.get("category")
            qs = qs.filter(status=Trip.STATUS_APPROVED, visibility=Trip.VISIBILITY_PUBLIC)
            if category:
                qs = qs.filter(category__slug=category)
        elif tab == "booked":
            # Show trips that have at least one booking
            qs = qs.filter(advisor=request.user).filter(bookings__isnull=False).distinct()
        else:
            qs = qs.filter(status=Trip.STATUS_APPROVED, visibility=Trip.VISIBILITY_PUBLIC).order_by("-rating", "-created_at")

        return Response(TripSerializer(qs[:100], many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = TripSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        category = AdvisorCategory.objects.filter(id=serializer.validated_data["category_id"], is_active=True).first()
        if not category:
            return Response({"detail": "Category not found."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            trip = Trip.objects.create(
                advisor=request.user,
                category=category,
                title=serializer.validated_data["title"],
                destination=serializer.validated_data["destination"],
                duration_days=serializer.validated_data.get("duration_days", 1),
                available_dates=serializer.validated_data.get("available_dates", []),
                booked_hotels=serializer.validated_data.get("booked_hotels", []),
                restaurants=serializer.validated_data.get("restaurants", []),
                itinerary_json=serializer.validated_data.get("itinerary_json", {}),
                included_services=serializer.validated_data.get("included_services", []),
                advisor_advantages=serializer.validated_data.get("advisor_advantages", []),
                price=serializer.validated_data.get("price", 0),
                social_links=serializer.validated_data.get("social_links", {}),
                map_route=serializer.validated_data.get("map_route", {}),
                media_urls=serializer.validated_data.get("media_urls", []),
                customer_user=serializer.validated_data.get("customer_user"),
                visibility=serializer.validated_data.get("visibility", Trip.VISIBILITY_PRIVATE),
                status=Trip.STATUS_DRAFT,
            )
            create_trip_version(trip=trip, actor=request.user)

        return Response(TripSerializer(trip).data, status=status.HTTP_201_CREATED)


class AdvisorTripDetailView(RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]
    serializer_class = TripSerializer
    lookup_field = "id"
    lookup_url_kwarg = "trip_id"

    def get_queryset(self):
        return Trip.objects.filter(advisor=self.request.user).select_related("category")


class AdvisorTripUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]

    def patch(self, request, trip_id):
        trip = Trip.objects.filter(id=trip_id, advisor=request.user).first()
        if not trip:
            return Response({"detail": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = TripUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            if field == "category_id":
                category = AdvisorCategory.objects.filter(id=value, is_active=True).first()
                if not category:
                    return Response({"detail": "Category not found."}, status=status.HTTP_400_BAD_REQUEST)
                if request.user.role == User.Role.TRIPADVISOR:
                    profile = getattr(request.user, "trip_advisor_profile", None)
                    if profile and profile.categories.exists() and not profile.categories.filter(id=category.id).exists():
                        return Response({"detail": "Trip category must match advisor categories."}, status=status.HTTP_400_BAD_REQUEST)
                trip.category = category
            else:
                setattr(trip, field, value)

        trip.version += 1
        trip.save()
        create_trip_version(trip=trip, actor=request.user)
        return Response(TripSerializer(trip).data, status=status.HTTP_200_OK)


class AdvisorTripSubmitView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]

    def post(self, request, trip_id):
        trip = Trip.objects.filter(id=trip_id, advisor=request.user).first()
        if not trip:
            return Response({"detail": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        if trip.visibility == Trip.VISIBILITY_PUBLIC:
            submit_trip_for_moderation(trip=trip, actor=request.user)
        else:
            trip.status = Trip.STATUS_APPROVED
            trip.approved_at = timezone.now()
            trip.save(update_fields=["status", "approved_at", "updated_at"])

        log_action(actor=request.user, action="trip.submitted", trip=trip)
        return Response(TripSerializer(trip).data, status=status.HTTP_200_OK)


class AdvisorTripVersionsView(ListAPIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]
    serializer_class = TripVersionSerializer

    def get_queryset(self):
        trip = Trip.objects.filter(id=self.kwargs["trip_id"], advisor=self.request.user).first()
        if not trip:
            return Trip.objects.none()
        return trip.versions.all()


class AdvisorTripMediaUploadView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, trip_id):
        trip = Trip.objects.filter(id=trip_id, advisor=request.user).first()
        if not trip:
            return Response({"detail": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        uploaded_file = request.FILES.get("file") or request.FILES.get("media")
        if not uploaded_file:
            return Response({"detail": "File is required."}, status=status.HTTP_400_BAD_REQUEST)

        media = TripMedia.objects.create(trip=trip, file=uploaded_file, uploaded_by=request.user)
        try:
            media_url = media.file.url
        except ValueError:
            media_url = ""

        if media_url:
            trip.media_urls = list(trip.media_urls or [])
            if media_url not in trip.media_urls:
                trip.media_urls.append(media_url)
                trip.save(update_fields=["media_urls", "updated_at"])

        return Response(TripMediaSerializer(media).data, status=status.HTTP_201_CREATED)


class ConvertThreadToTripView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]

    def post(self, request, thread_id):
        thread = ChatThread.objects.filter(id=thread_id, user=request.user).first()
        if not thread:
            return Response({"detail": "Thread not found."}, status=status.HTTP_404_NOT_FOUND)

        plan = thread.plan_json or {}
        category = AdvisorCategory.objects.filter(is_active=True).first()
        if not category:
            return Response({"detail": "At least one advisor category is required."}, status=status.HTTP_400_BAD_REQUEST)

        trip = Trip.objects.create(
            advisor=request.user,
            category=category,
            title=thread.title or f"{thread.city} itinerary",
            destination=thread.city or plan.get("city") or "",
            duration_days=plan.get("days_generated") or 1,
            itinerary_json=plan,
            visibility=Trip.VISIBILITY_PRIVATE,
            status=Trip.STATUS_DRAFT,
        )
        create_trip_version(trip=trip, actor=request.user)
        return Response(TripSerializer(trip).data, status=status.HTTP_201_CREATED)


class WishlistFolderListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        folders = WishlistFolder.objects.filter(user=request.user).prefetch_related("items")
        return Response(WishlistFolderSerializer(folders, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = WishlistFolderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        folder = WishlistFolder.objects.create(user=request.user, name=serializer.validated_data["name"])
        return Response(WishlistFolderSerializer(folder).data, status=status.HTTP_201_CREATED)


class WishlistFolderItemView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, folder_id):
        folder = WishlistFolder.objects.filter(id=folder_id, user=request.user).first()
        if not folder:
            return Response({"detail": "Folder not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WishlistItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item, _ = WishlistItem.objects.get_or_create(folder=folder, place=serializer.validated_data["place"])
        return Response(WishlistItemSerializer(item).data, status=status.HTTP_201_CREATED)


class ManagerApplicationQueueView(ListAPIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsManagerRole]
    serializer_class = TripAdvisorApplicationManagerSerializer

    def get_queryset(self):
        status_filter = self.request.query_params.get("status", TripAdvisorApplication.STATUS_PENDING)
        return TripAdvisorApplication.objects.select_related("user").filter(status=status_filter)


class ManagerApplicationReviewView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsManagerRole]

    def post(self, request, application_id):
        application = TripAdvisorApplication.objects.select_related("user").filter(id=application_id).first()
        if not application:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = TripAdvisorApplicationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        app_status = serializer.validated_data["status"]
        reason = serializer.validated_data.get("reason", "")

        application.status = app_status
        application.review_reason = reason
        application.reviewed_at = timezone.now()
        application.reviewed_by = request.user
        application.save(update_fields=["status", "review_reason", "reviewed_at", "reviewed_by", "updated_at"])

        target_user = application.user
        if app_status == TripAdvisorApplication.STATUS_APPROVED:
            target_user.role = User.Role.TRIPADVISOR
            target_user.save(update_fields=["role"])
            TripAdvisorProfile.objects.get_or_create(user=target_user)

        log_action(actor=request.user, action="advisor.application.reviewed", reason=reason, target_user=target_user, application=application, metadata={"status": app_status})
        return Response(TripAdvisorApplicationManagerSerializer(application).data, status=status.HTTP_200_OK)


class ManagerTripModerationQueueView(ListAPIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsManagerRole]
    serializer_class = TripSerializer

    def get_queryset(self):
        return Trip.objects.filter(status=Trip.STATUS_PENDING, visibility=Trip.VISIBILITY_PUBLIC).select_related("advisor", "category")


class ManagerTripModerationActionView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsManagerRole]

    def post(self, request, trip_id):
        trip = Trip.objects.select_related("advisor").filter(id=trip_id).first()
        if not trip:
            return Response({"detail": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = TripModerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["status"]
        reason = serializer.validated_data.get("reason", "")

        if decision == Trip.STATUS_APPROVED:
            approve_trip(trip=trip, manager=request.user)
        else:
            reject_trip(trip=trip, reason=reason)
            profile = getattr(trip.advisor, "trip_advisor_profile", None)
            if profile:
                profile.violation_count += 1
                refresh_profile_ranking(profile)

        log_action(actor=request.user, action="trip.moderated", reason=reason, target_user=trip.advisor, trip=trip, metadata={"status": decision})
        return Response(TripSerializer(trip).data, status=status.HTTP_200_OK)


class ManagerRestrictUserView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsManagerRole]

    def post(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        payload = request.data.copy()
        payload["user"] = target.id
        serializer = UserRestrictionSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        restriction = UserRestriction.objects.create(
            user=target,
            created_by=request.user,
            reason=serializer.validated_data["reason"],
            details=serializer.validated_data.get("details", ""),
            expires_at=serializer.validated_data.get("expires_at"),
        )

        target.is_blocked = True
        target.block_expires_at = restriction.expires_at
        target.is_active = False
        target.save(update_fields=["is_blocked", "block_expires_at", "is_active"])

        log_action(actor=request.user, action="user.temporarily_blocked", target_user=target, reason=restriction.details)
        return Response(UserRestrictionSerializer(restriction).data, status=status.HTTP_201_CREATED)


class ManagerModerationLogView(ListAPIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsManagerRole]
    serializer_class = ModerationLogSerializer

    def get_queryset(self):
        qs = ModerationLog.objects.select_related("actor", "target_user", "trip", "application")
        target_user_id = self.request.query_params.get("target_user_id")
        if target_user_id:
            qs = qs.filter(target_user_id=target_user_id)
        return qs


class AdminAssignManagerView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsAdminRole]

    def post(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        target.role = User.Role.MANAGER
        target.save(update_fields=["role"])
        log_action(actor=request.user, action="user.promoted_to_manager", target_user=target)
        return Response({"detail": "User promoted to manager."}, status=status.HTTP_200_OK)


class AdminPermanentBanView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsAdminRole]

    def post(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        target.is_blocked = True
        target.block_expires_at = None
        target.is_active = False
        target.deleted_at = timezone.now()
        target.save(update_fields=["is_blocked", "block_expires_at", "is_active", "deleted_at"])

        log_action(actor=request.user, action="user.permanently_banned", target_user=target)
        return Response({"detail": "User permanently banned."}, status=status.HTTP_200_OK)


class SubscriptionWebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get("email")
        user_id = request.data.get("user_id")
        new_status = (request.data.get("subscription_status") or "").upper()

        if new_status not in {User.SubscriptionStatus.ACTIVE, User.SubscriptionStatus.INACTIVE, User.SubscriptionStatus.CANCELED}:
            return Response({"detail": "Invalid subscription status."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(id=user_id).first() if user_id else None
        if not user and email:
            user = User.objects.filter(email=email).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        old_status = user.subscription_status
        user.subscription_status = new_status
        user.save(update_fields=["subscription_status"])

        SubscriptionEvent.objects.create(
            user=user,
            provider=request.data.get("provider", "webhook"),
            external_event_id=request.data.get("event_id", ""),
            old_status=old_status,
            new_status=new_status,
            payload=request.data,
        )

        log_action(actor=None, action="subscription.status_changed", target_user=user, metadata={"old": old_status, "new": new_status})
        return Response({"detail": "Subscription updated."}, status=status.HTTP_200_OK)


class TripAdvisorLeaderboardView(ListAPIView):
    serializer_class = TripAdvisorProfileSerializer

    def get_queryset(self):
        return TripAdvisorProfile.objects.select_related("user").filter(user__role=User.Role.TRIPADVISOR).order_by("-ranking_score")[:100]


class PublicTripListView(ListAPIView):
    serializer_class = TripSerializer

    def get_queryset(self):
        tab = self.request.query_params.get("tab", "recommended")
        saved = self.request.query_params.get("saved", "").lower() in {"true", "1", "yes"}
        qs = Trip.objects.filter(status=Trip.STATUS_APPROVED, visibility=Trip.VISIBILITY_PUBLIC).select_related("category", "advisor")

        if saved and self.request.user.is_authenticated:
            # Filter to only saved trips
            qs = qs.filter(saved_by__user=self.request.user)

        if tab == "top-rated":
            return qs.order_by("-rating", "-review_count")
        if tab == "categories":
            category = self.request.query_params.get("category")
            if category:
                qs = qs.filter(Q(category__slug=category) | Q(category__name__iexact=category))
        return qs.order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        # Pre-compute saved trips for the authenticated user
        if self.request.user.is_authenticated:
            saved_trip_ids = set(
                SavedTrip.objects.filter(user=self.request.user).values_list("trip_id", flat=True)
            )
            context["saved_trip_ids"] = saved_trip_ids
        else:
            context["saved_trip_ids"] = set()
        return context


class SavedTripToggleView(APIView):
    """Toggle a trip in the user's saved trips (wishlist)."""
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, trip_id):
        """Save a trip to wishlist."""
        trip = get_object_or_404(Trip, id=trip_id, status=Trip.STATUS_APPROVED, visibility=Trip.VISIBILITY_PUBLIC)

        saved_trip, created = SavedTrip.objects.get_or_create(
            user=request.user,
            trip=trip,
        )

        return Response(
            {"trip_id": trip_id, "is_saved": True, "created": created},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, trip_id):
        """Remove a trip from wishlist."""
        SavedTrip.objects.filter(
            user=request.user,
            trip_id=trip_id,
        ).delete()

        return Response(
            {"trip_id": trip_id, "is_saved": False},
            status=status.HTTP_200_OK,
        )


class PlaceCommentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class PlaceCommentListCreateView(ListCreateAPIView):
    """
    GET /api/places/{place_id}/comments — paginated; ordered by likes (desc), then created_at (desc).
    POST /api/places/{place_id}/comments
    """

    serializer_class = CommentSerializer
    pagination_class = PlaceCommentPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsActiveAndNotBlocked()]
        return []

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.place = get_object_or_404(Place, id=kwargs["place_id"])

    def get_queryset(self):
        qs = (
            Comment.objects.filter(place=self.place, is_deleted=False)
            .select_related("user")
            .order_by("-likes_count", "-created_at")
        )
        user = self.request.user
        if user.is_authenticated:
            qs = qs.annotate(
                liked_by_me=Exists(
                    CommentLike.objects.filter(
                        comment_id=OuterRef("pk"),
                        user_id=user.id,
                    )
                )
            )
        else:
            qs = qs.annotate(liked_by_me=Value(False, output_field=BooleanField()))
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, place=self.place, trip=None)


class PlaceCommentLikeView(APIView):
    """
    POST /api/places/{place_id}/comments/{comment_id}/like — like (idempotent on duplicate: 200 + already liked).
    DELETE /api/places/{place_id}/comments/{comment_id}/like — unlike (idempotent: 200 if not liked).
    """

    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def _get_comment(self, place_id, comment_id):
        return Comment.objects.filter(
            id=comment_id,
            place_id=place_id,
            is_deleted=False,
        ).first()

    def post(self, request, place_id, comment_id):
        comment = self._get_comment(place_id, comment_id)
        if not comment:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        if CommentLike.objects.filter(user=request.user, comment=comment).exists():
            comment.refresh_from_db(fields=["likes_count"])
            return Response(
                {"liked": True, "likes_count": comment.likes_count},
                status=status.HTTP_200_OK,
            )

        try:
            with transaction.atomic():
                CommentLike.objects.create(user=request.user, comment=comment)
                Comment.objects.filter(pk=comment.pk).update(likes_count=F("likes_count") + 1)
        except IntegrityError:
            comment.refresh_from_db(fields=["likes_count"])
            return Response(
                {"liked": True, "likes_count": comment.likes_count},
                status=status.HTTP_200_OK,
            )

        comment.refresh_from_db(fields=["likes_count"])
        return Response(
            {"liked": True, "likes_count": comment.likes_count},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, place_id, comment_id):
        comment = self._get_comment(place_id, comment_id)
        if not comment:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            deleted, _ = CommentLike.objects.filter(
                user=request.user,
                comment=comment,
            ).delete()
            if deleted:
                Comment.objects.filter(pk=comment.pk).update(
                    likes_count=Greatest(F("likes_count") - 1, Value(0))
                )

        comment.refresh_from_db(fields=["likes_count"])
        return Response(
            {"liked": False, "likes_count": comment.likes_count},
            status=status.HTTP_200_OK,
        )


class BookTripView(APIView):
    """
    Book a trip (for regular users).
    POST /api/marketplace/trips/{trip_id}/book/
    """
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, trip_id):
        trip = get_object_or_404(Trip, id=trip_id)

        serializer = TripBookingCreateSerializer(data=request.data, context={"trip": trip})
        serializer.is_valid(raise_exception=True)

        try:
            booking = book_trip(
                trip=trip,
                user=request.user,
                number_of_travelers=serializer.validated_data["number_of_travelers"],
            )
        except ValidationError as e:
            return Response({"detail": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            TripBookingSerializer(booking).data,
            status=status.HTTP_201_CREATED,
        )


class MyBookingsView(ListAPIView):
    """
    Get current user's trip bookings.
    GET /api/marketplace/my-bookings/
    """
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]
    serializer_class = TripBookingSerializer
    pagination_class = None  # Return plain array, not paginated

    def get_queryset(self):
        status_filter = self.request.query_params.get("status")
        return get_user_bookings(self.request.user, status_filter).select_related("trip")


class TripBookingsListView(APIView):
    """
    Get all bookings for a trip (for trip advisor).
    GET /api/marketplace/trips/{trip_id}/bookings/
    """
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]

    def get(self, request, trip_id):
        trip = get_object_or_404(Trip, id=trip_id, advisor=request.user)
        status_filter = self.request.query_params.get("status")
        bookings = get_trip_bookings(trip, status_filter)
        return Response(TripBookingSerializer(bookings, many=True).data, status=status.HTTP_200_OK)


class CancelBookingView(APIView):
    """
    Cancel a trip booking.
    POST /api/marketplace/bookings/{booking_id}/cancel/

    Users can cancel their own bookings.
    Trip advisors can cancel any booking on their trips.
    """
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, booking_id):
        booking = get_object_or_404(TripBooking, id=booking_id)

        # Check permissions: user can cancel own booking, advisor can cancel bookings on their trips
        if booking.user != request.user and booking.trip.advisor != request.user:
            return Response(
                {"detail": "You do not have permission to cancel this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        reason = request.data.get("reason", "")

        try:
            cancel_booking(
                booking=booking,
                cancel_reason=reason,
                cancelled_by=request.user,
            )
        except ValidationError as e:
            return Response({"detail": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            TripBookingSerializer(booking).data,
            status=status.HTTP_200_OK,
        )


class ConfirmBookingView(APIView):
    """
    Confirm a pending booking (for trip advisors).
    POST /api/marketplace/bookings/{booking_id}/confirm/
    """
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked, IsTripAdvisorRole]

    def post(self, request, booking_id):
        booking = get_object_or_404(TripBooking, id=booking_id)

        # Only the trip advisor can confirm bookings
        if booking.trip.advisor != request.user:
            return Response(
                {"detail": "You do not have permission to confirm this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            confirm_booking(booking=booking)
        except ValidationError as e:
            return Response({"detail": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            TripBookingSerializer(booking).data,
            status=status.HTTP_200_OK,
        )

def _public_trip_queryset():
    return Trip.objects.filter(
        status=Trip.STATUS_APPROVED,
        visibility=Trip.VISIBILITY_PUBLIC,
    )


class TripCommentListCreateView(ListCreateAPIView):
    """
    GET /api/marketplace/public/trips/{trip_id}/comments — paginated.
    POST — create (authenticated).
    """

    serializer_class = CommentSerializer
    pagination_class = PlaceCommentPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsActiveAndNotBlocked()]
        return []

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.trip = get_object_or_404(_public_trip_queryset(), id=kwargs["trip_id"])

    def get_queryset(self):
        qs = (
            Comment.objects.filter(trip=self.trip, is_deleted=False)
            .select_related("user")
            .order_by("-likes_count", "-created_at")
        )
        user = self.request.user
        if user.is_authenticated:
            qs = qs.annotate(
                liked_by_me=Exists(
                    CommentLike.objects.filter(
                        comment_id=OuterRef("pk"),
                        user_id=user.id,
                    )
                )
            )
        else:
            qs = qs.annotate(liked_by_me=Value(False, output_field=BooleanField()))
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, trip=self.trip, place=None)


class TripCommentLikeView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def _get_comment(self, trip_id, comment_id):
        trip = _public_trip_queryset().filter(id=trip_id).first()
        if not trip:
            return None
        return Comment.objects.filter(
            id=comment_id,
            trip_id=trip_id,
            is_deleted=False,
        ).first()

    def post(self, request, trip_id, comment_id):
        comment = self._get_comment(trip_id, comment_id)
        if not comment:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        if CommentLike.objects.filter(user=request.user, comment=comment).exists():
            comment.refresh_from_db(fields=["likes_count"])
            return Response(
                {"liked": True, "likes_count": comment.likes_count},
                status=status.HTTP_200_OK,
            )

        try:
            with transaction.atomic():
                CommentLike.objects.create(user=request.user, comment=comment)
                Comment.objects.filter(pk=comment.pk).update(likes_count=F("likes_count") + 1)
        except IntegrityError:
            comment.refresh_from_db(fields=["likes_count"])
            return Response(
                {"liked": True, "likes_count": comment.likes_count},
                status=status.HTTP_200_OK,
            )

        comment.refresh_from_db(fields=["likes_count"])
        return Response(
            {"liked": True, "likes_count": comment.likes_count},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, trip_id, comment_id):
        comment = self._get_comment(trip_id, comment_id)
        if not comment:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            deleted, _ = CommentLike.objects.filter(
                user=request.user,
                comment=comment,
            ).delete()
            if deleted:
                Comment.objects.filter(pk=comment.pk).update(
                    likes_count=Greatest(F("likes_count") - 1, Value(0))
                )

        comment.refresh_from_db(fields=["likes_count"])
        return Response(
            {"liked": False, "likes_count": comment.likes_count},
            status=status.HTTP_200_OK,
        )
