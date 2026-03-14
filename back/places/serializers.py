from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Place, MustVisitPlace, UserMapPlace, VisitedPlace

User = get_user_model()


class PublicMapUserListSerializer(serializers.ModelSerializer):
    """Minimal user info for list of users who shared their map (id, username, email, avatar, is_trip_advisor)."""

    is_trip_advisor = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "avatar", "is_trip_advisor"]

    def get_is_trip_advisor(self, obj):
        return getattr(obj, "role", None) == User.Role.TRIPADVISOR


class PlaceSerializer(serializers.ModelSerializer):
    is_must_visit = serializers.SerializerMethodField()

    def get_is_must_visit(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        if hasattr(obj, "is_must_visit_for_user"):
            return bool(obj.is_must_visit_for_user)

        return MustVisitPlace.objects.filter(user=request.user, place=obj).exists()

    class Meta:
        model = Place
        fields = [
            "id",
            "name",
            "category",
            "address",
            "city",
            "country",
            "rating",
            "price_level",
            "opening_hours",
            "photo_url",
            "website",
            "neighborhood",
            "is_must_visit",
            "status",
            "saves_count",
        ]


class PlaceMapSerializer(serializers.ModelSerializer):
    is_must_visit = serializers.SerializerMethodField()

    def get_is_must_visit(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        if hasattr(obj, "is_must_visit_for_user"):
            return bool(obj.is_must_visit_for_user)

        return MustVisitPlace.objects.filter(user=request.user, place=obj).exists()

    class Meta:
        model = Place
        fields = [
            "id",
            "google_place_id",
            "name",
            "category",
            "address",
            "city",
            "country",
            "lat",
            "lng",
            "rating",
            "price_level",
            "opening_hours",
            "photo_url",
            "website",
            "neighborhood",
            "is_must_visit",
            "status",
            "saves_count",
        ]


class UserMapPlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMapPlace
        fields = ["id", "city", "country", "date", "lat", "lon", "created_at"]


class PublicUserMapPlaceSerializer(serializers.ModelSerializer):
    """Map place for public view — no dates or time-related fields."""

    class Meta:
        model = UserMapPlace
        fields = ["id", "city", "country", "lat", "lon"]


class VisitedPlaceSerializer(serializers.ModelSerializer):
    place = PlaceMapSerializer(read_only=True)

    class Meta:
        model = VisitedPlace
        fields = ["id", "place_id", "place", "created_at"]
        read_only_fields = ["id", "place_id", "place", "created_at"]


class PublicVisitedPlaceSerializer(serializers.ModelSerializer):
    """Visited place for public view — no dates or time-related fields."""

    place = PlaceMapSerializer(read_only=True)

    class Meta:
        model = VisitedPlace
        fields = ["id", "place_id", "place"]
