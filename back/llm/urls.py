from django.urls import path
from .views import TravelChatView, TravelPlanView

urlpatterns = [
    path("chat/", TravelChatView.as_view(), name="travel-chat"),
    path("plan/", TravelPlanView.as_view(), name="travel-plan"),
]
