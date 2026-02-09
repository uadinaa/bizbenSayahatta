from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField()


class TripPlanRequestSerializer(serializers.Serializer):
    city = serializers.CharField()
    days = serializers.IntegerField(min_value=1, max_value=14)
    budget = serializers.IntegerField(required=False, allow_null=True)
    interests = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    pace = serializers.ChoiceField(
        choices=["slow", "medium", "fast"],
        required=False
    )
    travel_style = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )
    use_preferences = serializers.BooleanField(required=False, default=True)
