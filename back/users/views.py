from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User, UserPreferences
from marketplace.models import TripAdvisorApplication, TripAdvisorProfile
from .permissions import IsActiveAndNotBlocked
from .serializers import (
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    PrivacySettingsSerializer,
    RegisterSerializer,
    UserPreferencesSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .services import sync_user_travel_profile
import secrets


class CustomTokenObtainPairView(TokenObtainPairView):
    """JWT login that accepts email + password."""
    serializer_class = CustomTokenObtainPairSerializer


class CustomTokenRefreshView(TokenRefreshView):
    """JWT refresh that degrades deleted-user tokens into a clean auth failure."""

    serializer_class = CustomTokenRefreshSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        UserPreferences.objects.get_or_create(user=request.user)
        traveler_profile = sync_user_travel_profile(request.user)
        if request.user.role == User.Role.USER:
            approved_exists = TripAdvisorApplication.objects.filter(
                user=request.user,
                status=TripAdvisorApplication.STATUS_APPROVED
            ).exists()
            if approved_exists:
                request.user.role = User.Role.TRIPADVISOR
                request.user.save(update_fields=["role"])
                TripAdvisorProfile.objects.get_or_create(user=request.user)
        return Response(
            UserSerializer(
                request.user,
                context={"request": request, "traveler_profile": traveler_profile},
            ).data
        )

    def put(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)

        user_fields = {k: v for k, v in request.data.items() if k in {"username", "avatar", "cover", "is_map_public"}}
        user_serializer = UserUpdateSerializer(request.user, data=user_fields, partial=True)
        user_serializer.is_valid(raise_exception=True)
        user_serializer.save()
        if "is_map_public" in user_fields and not request.user.map_share_token:
            request.user.map_share_token = secrets.token_urlsafe(32)
            request.user.save(update_fields=["map_share_token"])

        pref_fields = {"budget", "travel_style", "citizenship", "open_now", "interests"}
        pref_data = {key: value for key, value in request.data.items() if key in pref_fields}
        if pref_data:
            pref_serializer = UserPreferencesSerializer(prefs, data=pref_data, partial=True)
            pref_serializer.is_valid(raise_exception=True)
            pref_serializer.save()

        traveler_profile = sync_user_travel_profile(request.user)
        return Response(
            UserSerializer(
                request.user,
                context={"request": request, "traveler_profile": traveler_profile},
            ).data
        )

    def patch(self, request):
        return self.put(request)


class PrivacySettingsView(APIView):
    """PATCH /users/profile/privacy/ — only the profile owner can update map/visited/badges visibility."""

    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def patch(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)
        body = request.data.copy()
        raw_public = body.pop("is_map_public", None)

        serializer = PrivacySettingsSerializer(prefs, data=body, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if raw_public is not None:
            request.user.is_map_public = str(raw_public).lower() in {"1", "true", "yes"}
            if not request.user.map_share_token:
                request.user.map_share_token = secrets.token_urlsafe(32)
            request.user.save(update_fields=["is_map_public", "map_share_token"])

        data = PrivacySettingsSerializer(prefs).data
        data["is_map_public"] = request.user.is_map_public
        return Response(data)


class MapShareTokenRotateView(APIView):
    """POST — issue a new map_share_token (invalidates old shared links)."""

    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request):
        user = request.user
        user.map_share_token = secrets.token_urlsafe(32)
        user.save(update_fields=["map_share_token"])
        return Response({"map_share_token": user.map_share_token})
