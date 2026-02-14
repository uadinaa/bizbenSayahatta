from rest_framework import serializers
from .models import ChatThread, ChatEntry


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


class ChatThreadCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["planner", "ai"])
    title = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)


class ChatThreadListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatThread
        fields = [
            "id",
            "kind",
            "title",
            "city",
            "start_date",
            "end_date",
            "updated_at",
        ]


class ChatThreadDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatThread
        fields = [
            "id",
            "kind",
            "title",
            "city",
            "start_date",
            "end_date",
            "plan_json",
            "updated_at",
        ]


class ChatEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatEntry
        fields = [
            "id",
            "role",
            "content",
            "created_at",
        ]


class ChatEntryCreateSerializer(serializers.Serializer):
    message = serializers.CharField()
