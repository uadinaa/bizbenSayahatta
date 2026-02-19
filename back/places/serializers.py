from rest_framework import serializers
from .models import Place, MustVisitPlace, UserMapPlace

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
