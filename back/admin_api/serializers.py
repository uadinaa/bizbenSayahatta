from rest_framework import serializers
from django.contrib.auth import get_user_model
from places.models import SavedPlace, VisitedPlace, Place, InterestMapping
from llm.models import ChatThread, ChatEntry, ChatMessage

User = get_user_model()


class AdminUserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "is_active",
            "is_staff",
            "date_joined",
            "deleted_at",
        )


class AdminUserDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "avatar",
            "is_active",
            "is_staff",
            "date_joined",
            "deleted_at",
        )


class AdminUserBlockSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=True)


class PlaceMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = ("id", "name", "category", "city", "country")


class AdminWishlistSerializer(serializers.ModelSerializer):
    place = PlaceMinimalSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = SavedPlace
        fields = ("id", "user_id", "place", "created_at")


class AdminVisitedPlaceSerializer(serializers.ModelSerializer):
    place = PlaceMinimalSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = VisitedPlace
        fields = ("id", "user_id", "place", "created_at", "visited_at")


class AdminChatThreadSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = ChatThread
        fields = (
            "id",
            "user_id",
            "kind",
            "title",
            "city",
            "start_date",
            "end_date",
            "created_at",
            "updated_at",
        )


class AdminChatMessageSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ("id", "user_id", "user_message", "ai_response", "created_at")


class AdminInterestMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterestMapping
        fields = ("id", "name", "mappings")
