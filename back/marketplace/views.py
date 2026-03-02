from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from llm.models import ChatThread
from users.models import User
from users.permissions import IsActiveAndNotBlocked

from .models import (
    AdvisorCategory,
    TripAdvisorApplication,
    TripAdvisorProfile,
    Trip,
    WishlistFolder,
    WishlistItem,
    UserRestriction,
    ModerationLog,
    SubscriptionEvent,
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
    WishlistFolderSerializer,
    WishlistItemSerializer,
    UserRestrictionSerializer,
    ModerationLogSerializer,
)
from .services.audit import log_action
from .services.ranking import refresh_profile_ranking
from .services.trips import create_trip_version, submit_trip_for_moderation, approve_trip, reject_trip


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
        else:
            qs = qs.filter(status=Trip.STATUS_APPROVED, visibility=Trip.VISIBILITY_PUBLIC).order_by("-rating", "-created_at")

        return Response(TripSerializer(qs[:100], many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = TripSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        category = AdvisorCategory.objects.get(id=serializer.validated_data["category_id"])
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
            try:
                submit_trip_for_moderation(trip=trip, actor=request.user)
            except Exception as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
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
        qs = Trip.objects.filter(status=Trip.STATUS_APPROVED, visibility=Trip.VISIBILITY_PUBLIC).select_related("category", "advisor")
        if tab == "top-rated":
            return qs.order_by("-rating", "-review_count")
        if tab == "categories":
            category = self.request.query_params.get("category")
            if category:
                qs = qs.filter(Q(category__slug=category) | Q(category__name__iexact=category))
        return qs.order_by("-created_at")
