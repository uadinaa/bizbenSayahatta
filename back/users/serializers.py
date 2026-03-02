from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password

from .models import User, UserPreferences


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("email", "username", "password", "password2", "avatar", "cover", "referral_code")

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError("Passwords do not match")
        return attrs

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        referral_code = validated_data.pop("referral_code", "")
        validated_data.pop("password2")
        user = User.objects.create_user(**validated_data)
        UserPreferences.objects.create(user=user)
        if referral_code:
            from marketplace.services.referral import reward_referral_if_eligible
            reward_referral_if_eligible(referred_user=user, referral_code=referral_code)
        return user


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ("budget", "travel_style", "open_now", "interests")


class UserSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(read_only=True)

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
        )


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("username", "avatar", "cover")
