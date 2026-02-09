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
