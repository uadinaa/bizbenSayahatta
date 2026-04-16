from rest_framework import serializers

from places.models import Place
from users.models import User

from .models import (
    AdvisorCategory,
    TripAdvisorApplication,
    TripAdvisorProfile,
    Trip,
    TripMedia,
    TripVersion,
    TripBooking,
    Comment,
    CommentLike,
    WishlistFolder,
    WishlistItem,
    UserRestriction,
    ModerationLog,
)


class AdvisorCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AdvisorCategory
        fields = ("id", "name", "slug")


class TripAdvisorApplicationCreateSerializer(serializers.ModelSerializer):
    category_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    class Meta:
        model = TripAdvisorApplication
        fields = (
            "contract_accepted",
            "terms_accepted",
            "subscription_plan",
            "payment_reference",
            "cv_file",
            "portfolio_links",
            "notes",
            "category_ids",
        )

    def validate(self, attrs):
        if not attrs.get("contract_accepted"):
            raise serializers.ValidationError("Contract must be accepted.")
        if not attrs.get("terms_accepted"):
            raise serializers.ValidationError("Terms must be accepted.")
        return attrs


class TripAdvisorApplicationSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = TripAdvisorApplication
        fields = (
            "id",
            "user_id",
            "contract_accepted",
            "terms_accepted",
            "subscription_plan",
            "payment_reference",
            "portfolio_links",
            "notes",
            "status",
            "review_reason",
            "reviewed_at",
            "created_at",
            "updated_at",
        )


class TripAdvisorApplicationManagerSerializer(TripAdvisorApplicationSerializer):
    cv_file = serializers.FileField(read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta(TripAdvisorApplicationSerializer.Meta):
        fields = TripAdvisorApplicationSerializer.Meta.fields + ("cv_file", "user_email")


class TripAdvisorApplicationReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            TripAdvisorApplication.STATUS_APPROVED,
            TripAdvisorApplication.STATUS_REJECTED,
            TripAdvisorApplication.STATUS_MORE_INFO,
        ]
    )
    reason = serializers.CharField(required=False, allow_blank=True)


class TripAdvisorProfileSerializer(serializers.ModelSerializer):
    categories = AdvisorCategorySerializer(many=True, read_only=True)

    class Meta:
        model = TripAdvisorProfile
        fields = (
            "user_id",
            "categories",
            "description",
            "social_links",
            "verified",
            "rating",
            "total_reviews",
            "completed_trips",
            "engagement_score",
            "trust_score",
            "ranking_score",
            "status_level",
            "violation_count",
        )


class TripAdvisorProfileUpdateSerializer(serializers.ModelSerializer):
    category_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    class Meta:
        model = TripAdvisorProfile
        fields = ("description", "social_links", "category_ids")


class TripSerializer(serializers.ModelSerializer):
    advisor_id = serializers.IntegerField(read_only=True)
    category = AdvisorCategorySerializer(read_only=True)
    category_id = serializers.IntegerField(write_only=True)
    is_saved = serializers.SerializerMethodField()
    is_booked_by_me = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()
    current_bookings = serializers.IntegerField(read_only=True)
    max_travelers = serializers.IntegerField(required=False)

    class Meta:
        model = Trip
        fields = (
            "id",
            "advisor_id",
            "title",
            "category",
            "category_id",
            "destination",
            "duration_days",
            "available_dates",
            "booked_hotels",
            "restaurants",
            "itinerary_json",
            "included_services",
            "advisor_advantages",
            "price",
            "social_links",
            "map_route",
            "media_urls",
            "customer_user",
            "visibility",
            "status",
            "rating",
            "review_count",
            "rejection_reason",
            "submitted_at",
            "approved_at",
            "created_at",
            "updated_at",
            "is_saved",
            "is_booked_by_me",
            "is_full",
            "current_bookings",
            "max_travelers",
        )
        read_only_fields = (
            "status",
            "rating",
            "review_count",
            "rejection_reason",
            "submitted_at",
            "approved_at",
            "created_at",
            "updated_at",
            "current_bookings",
        )

    def get_is_saved(self, obj):
        saved_trip_ids = self.context.get("saved_trip_ids", set())
        return obj.id in saved_trip_ids

    def get_is_booked_by_me(self, obj):
        request = self.context.get("request")
        if not request or not hasattr(request, 'user') or not request.user.is_authenticated:
            return False
        # Check if user has an active booking for this trip
        return TripBooking.objects.filter(
            trip=obj,
            user=request.user,
            status__in=[TripBooking.STATUS_PENDING, TripBooking.STATUS_CONFIRMED],
        ).exists()

    def get_is_full(self, obj):
        return obj.current_bookings >= obj.max_travelers

    def validate(self, attrs):
        category_id = attrs.get("category_id")
        if not AdvisorCategory.objects.filter(id=category_id, is_active=True).exists():
            raise serializers.ValidationError({"category_id": "Unknown category."})

        request = self.context["request"]
        if request.user.role == User.Role.TRIPADVISOR:
            profile = getattr(request.user, "trip_advisor_profile", None)
            if profile and profile.categories.exists():
                allowed_ids = set(profile.categories.values_list("id", flat=True))
                if category_id not in allowed_ids:
                    raise serializers.ValidationError({"category_id": "Trip category must match advisor profile categories."})
        return attrs

    def validate_price(self, value):
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError("Price must be zero or greater.")
        return value


class TripUpdateSerializer(serializers.ModelSerializer):
    category_id = serializers.IntegerField(required=False)

    class Meta:
        model = Trip
        fields = (
            "title",
            "category_id",
            "destination",
            "duration_days",
            "available_dates",
            "booked_hotels",
            "restaurants",
            "itinerary_json",
            "included_services",
            "advisor_advantages",
            "price",
            "social_links",
            "map_route",
            "media_urls",
            "customer_user",
            "visibility",
        )


class TripModerationSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[Trip.STATUS_APPROVED, Trip.STATUS_REJECTED])
    reason = serializers.CharField(required=False, allow_blank=True)


class TripVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripVersion
        fields = ("id", "version", "snapshot", "created_by", "created_at")


class TripMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = TripMedia
        fields = ("id", "url", "created_at")

    def get_url(self, obj):
        try:
            return obj.file.url
        except ValueError:
            return ""
class CommentSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    place_id = serializers.IntegerField(read_only=True, allow_null=True)
    trip_id = serializers.IntegerField(read_only=True, allow_null=True)
    username = serializers.CharField(source="user.username", read_only=True)
    is_trip_advisor = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = (
            "id",
            "user_id",
            "username",
            "place_id",
            "trip_id",
            "comment_text",
            "is_trip_advisor",
            "likes_count",
            "liked_by_me",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "user_id",
            "username",
            "place_id",
            "trip_id",
            "is_trip_advisor",
            "likes_count",
            "liked_by_me",
            "created_at",
            "updated_at",
        )

    def get_is_trip_advisor(self, obj):
        from users.models import User as AppUser

        return getattr(obj.user, "role", None) == AppUser.Role.TRIPADVISOR

    def get_liked_by_me(self, obj):
        if getattr(obj, "liked_by_me", None) is not None:
            return bool(obj.liked_by_me)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            return False
        return CommentLike.objects.filter(comment_id=obj.pk, user_id=user.id).exists()

    def validate_comment_text(self, value: str) -> str:
        if value is None:
            raise serializers.ValidationError("Comment cannot be empty.")

        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("Comment cannot be empty or whitespace only.")
        if len(trimmed) < 3:
            raise serializers.ValidationError("Comment must be at least 3 characters long.")
        if len(trimmed) > 1000:
            raise serializers.ValidationError("Comment cannot exceed 1000 characters.")
        return trimmed


class WishlistItemSerializer(serializers.ModelSerializer):
    place = serializers.PrimaryKeyRelatedField(queryset=Place.objects.all())

    class Meta:
        model = WishlistItem
        fields = ("id", "place", "created_at")
        read_only_fields = ("id", "created_at")


class WishlistFolderSerializer(serializers.ModelSerializer):
    items = WishlistItemSerializer(many=True, read_only=True)

    class Meta:
        model = WishlistFolder
        fields = ("id", "name", "created_at", "items")


class UserRestrictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRestriction
        fields = ("id", "user", "reason", "details", "expires_at", "is_active", "created_at")
        read_only_fields = ("is_active", "created_at")


class ModerationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModerationLog
        fields = (
            "id",
            "actor_id",
            "target_user_id",
            "trip_id",
            "application_id",
            "action",
            "reason",
            "metadata",
            "created_at",
        )


class TripBookingSerializer(serializers.ModelSerializer):
    """Serializer for TripBooking model."""
    user_id = serializers.IntegerField(read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    trip_id = serializers.IntegerField(read_only=True)
    trip_title = serializers.CharField(source="trip.title", read_only=True)
    trip_destination = serializers.CharField(source="trip.destination", read_only=True)

    class Meta:
        model = TripBooking
        fields = (
            "id",
            "trip_id",
            "trip_title",
            "trip_destination",
            "user_id",
            "user_email",
            "user_username",
            "number_of_travelers",
            "status",
            "booked_at",
            "confirmed_at",
            "cancelled_at",
            "cancelled_by",
            "cancellation_reason",
        )
        read_only_fields = (
            "id",
            "trip_id",
            "trip_title",
            "trip_destination",
            "user_id",
            "user_email",
            "user_username",
            "booked_at",
            "confirmed_at",
            "cancelled_at",
            "cancelled_by",
        )


class TripBookingCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new trip booking."""
    number_of_travelers = serializers.IntegerField(min_value=1, default=1)

    class Meta:
        model = TripBooking
        fields = ("number_of_travelers",)

    def validate_number_of_travelers(self, value):
        trip = self.context.get("trip")
        if trip:
            available_spots = trip.max_travelers - trip.current_bookings
            if value > available_spots:
                raise serializers.ValidationError(
                    f"Only {available_spots} spots available for this trip."
                )
        return value
