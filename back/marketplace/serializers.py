from rest_framework import serializers

from places.models import Place
from users.models import User

from .models import (
    AdvisorCategory,
    TripAdvisorApplication,
    TripAdvisorProfile,
    Trip,
    TripVersion,
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
    advisor_id = serializers.IntegerField(source="advisor_id", read_only=True)
    category = AdvisorCategorySerializer(read_only=True)
    category_id = serializers.IntegerField(write_only=True)

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
        )

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
