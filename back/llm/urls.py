from django.urls import path
from .views import (
    TravelChatView,
    TravelPlanView,
    ChatThreadListCreateView,
    ChatThreadDetailView,
    ChatEntryListCreateView,
    ChatThreadPlanView,
)

urlpatterns = [
    path("chat/", TravelChatView.as_view(), name="travel-chat"),
    path("plan/", TravelPlanView.as_view(), name="travel-plan"),
    path("threads/", ChatThreadListCreateView.as_view(), name="chat-threads"),
    path("threads/<int:thread_id>/", ChatThreadDetailView.as_view(), name="chat-thread-detail"),
    path("threads/<int:thread_id>/messages/", ChatEntryListCreateView.as_view(), name="chat-thread-messages"),
    path("threads/<int:thread_id>/plan/", ChatThreadPlanView.as_view(), name="chat-thread-plan"),
]
