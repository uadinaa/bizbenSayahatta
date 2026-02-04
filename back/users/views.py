from rest_framework import generics
from .serializers import RegisterSerializer, UserPreferencesSerializer
from .models import User, UserPreferences
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import UserSerializer

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
        serializer = UserPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    