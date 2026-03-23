from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User, UserPreferences
from marketplace.models import TripAdvisorApplication, TripAdvisorProfile
from .permissions import IsActiveAndNotBlocked
from .serializers import (
    CustomTokenObtainPairSerializer,
    PrivacySettingsSerializer,
    RegisterSerializer,
    UserPreferencesSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .services import sync_user_travel_profile


class CustomTokenObtainPairView(TokenObtainPairView):
    """JWT login that accepts email + password."""
    serializer_class = CustomTokenObtainPairSerializer


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
        return Response(UserSerializer(request.user, context={"traveler_profile": traveler_profile}).data)

    def put(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)

        user_fields = {k: v for k, v in request.data.items() if k in {"username", "avatar", "cover"}}
        user_serializer = UserUpdateSerializer(request.user, data=user_fields, partial=True)
        user_serializer.is_valid(raise_exception=True)
        user_serializer.save()

        pref_fields = {"budget", "travel_style", "citizenship", "open_now", "interests"}
        pref_data = {key: value for key, value in request.data.items() if key in pref_fields}
        if pref_data:
            pref_serializer = UserPreferencesSerializer(prefs, data=pref_data, partial=True)
            pref_serializer.is_valid(raise_exception=True)
            pref_serializer.save()

        traveler_profile = sync_user_travel_profile(request.user)
        return Response(UserSerializer(request.user, context={"traveler_profile": traveler_profile}).data)

    def patch(self, request):
        return self.put(request)


class PrivacySettingsView(APIView):
    """PATCH /users/profile/privacy/ — only the profile owner can update map/visited/badges visibility."""

    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def patch(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)
        serializer = PrivacySettingsSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PrivacySettingsSerializer(prefs).data)
