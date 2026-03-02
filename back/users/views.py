from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import User, UserPreferences
from .permissions import IsActiveAndNotBlocked
from .serializers import (
    RegisterSerializer,
    UserPreferencesSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        UserPreferences.objects.get_or_create(user=request.user)
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)

        user_fields = {k: v for k, v in request.data.items() if k in {"username", "avatar", "cover"}}
        user_serializer = UserUpdateSerializer(request.user, data=user_fields, partial=True)
        user_serializer.is_valid(raise_exception=True)
        user_serializer.save()

        pref_fields = {"budget", "travel_style", "open_now", "interests"}
        pref_data = {key: value for key, value in request.data.items() if key in pref_fields}
        if pref_data:
            pref_serializer = UserPreferencesSerializer(prefs, data=pref_data, partial=True)
            pref_serializer.is_valid(raise_exception=True)
            pref_serializer.save()

        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        return self.put(request)
