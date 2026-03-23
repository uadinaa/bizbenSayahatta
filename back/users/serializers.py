from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, UserPreferences


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Accept email + password for login (User.USERNAME_FIELD is email)."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["email"] = serializers.EmailField(required=True)
        self.fields.pop("username", None)

    def validate(self, attrs):
        # Map email to username for parent's authenticate()
        attrs["username"] = attrs.get("email", "")
        return super().validate(attrs)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("email", "username", "password", "password2", "avatar", "cover", "referral_code")
        extra_kwargs = {
            "username": {"required": False, "allow_blank": True},
            "avatar": {"required": False, "allow_null": True},
            "cover": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError("Passwords do not match")
        return attrs

    def validate_password(self, value):
        validate_password(value)
        return value
    
    def create(self, validated_data):
        referral_code = validated_data.pop("referral_code", "")
        password = validated_data.pop("password")  
        validated_data.pop("password2")

        user = User.objects.create_user(password=password, **validated_data)
        UserPreferences.objects.create(user=user)

        if referral_code:
            from marketplace.services.referral import reward_referral_if_eligible
            reward_referral_if_eligible(referred_user=user, referral_code=referral_code)
        return user


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = (
            "budget",
            "travel_style",
            "citizenship",
            "traveler_level",
            "badges",
            "open_now",
            "interests",
            "share_map",
            "share_visited_places",
            "share_badges",
        )


class PrivacySettingsSerializer(serializers.ModelSerializer):
    """For PATCH profile/privacy/ — only these three fields, owner only."""

    class Meta:
        model = UserPreferences
        fields = ("share_map", "share_visited_places", "share_badges")


class UserSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(read_only=True)
    traveler_level = serializers.SerializerMethodField()
    badges = serializers.SerializerMethodField()
    history_summary = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "email",
            "avatar",
            "cover",
            "username",
            "role",
            "subscription_status",
            "tokens",
            "referral_code",
            "ranking_score",
            "status_level",
            "is_blocked",
            "preferences",
            "traveler_level",
            "badges",
            "history_summary",
        )

    def _profile(self, obj):
        return self.context.get("traveler_profile") or {}

    def get_traveler_level(self, obj):
        return self._profile(obj).get("traveler_level")

    def get_badges(self, obj):
        return self._profile(obj).get("badges", [])

    def get_history_summary(self, obj):
        return self._profile(obj).get("history_summary", {})


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("username", "avatar", "cover")
