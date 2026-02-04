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
            "status",
            "saves_count",
        ]
