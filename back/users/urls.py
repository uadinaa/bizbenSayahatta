from django.urls import path
from .views import RegisterView, UserProfileView
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path('signup/', RegisterView.as_view()),
    path('login/', TokenObtainPairView.as_view()),
    path('profile/', UserProfileView.as_view())
]