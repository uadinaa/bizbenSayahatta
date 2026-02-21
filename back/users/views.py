from rest_framework import generics
from .serializers import RegisterSerializer, UserPreferencesSerializer
from .models import User, UserPreferences
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import UserSerializer, UserUpdateSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        prefs, created = UserPreferences.objects.get_or_create(user=request.user)
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def put(self, request):
        prefs, created = UserPreferences.objects.get_or_create(user=request.user)
        user_serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
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
    
