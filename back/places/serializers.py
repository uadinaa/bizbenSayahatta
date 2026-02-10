from rest_framework import serializers
from .models import Place

class PlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = [
            "id",
            "name",
            "category",
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

