from django.urls import path
from .views import TravelChatView

urlpatterns = [
    path("chat/", TravelChatView.as_view(), name="travel-chat"),
]
