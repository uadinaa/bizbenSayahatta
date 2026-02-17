from rest_framework import serializers
from .models import Place, VisitedPlace

class PlaceSerializer(serializers.ModelSerializer):
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


class VisitedPlaceSerializer(serializers.ModelSerializer):
    place = PlaceMapSerializer(read_only=True)

    class Meta:
        model = VisitedPlace
        fields = ["id", "place_id", "place", "created_at", "visited_at"]
        read_only_fields = ["id", "place_id", "place", "created_at"]

    def update(self, instance, validated_data):
        if "visited_at" in validated_data:
            instance.visited_at = validated_data["visited_at"]
        instance.save(update_fields=["visited_at"])
        return instance

