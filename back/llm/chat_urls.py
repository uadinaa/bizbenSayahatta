from django.urls import path

from .views import ChatThreadArchiveView, ChatThreadDetailView, ChatThreadListCreateView, ChatThreadTripView


urlpatterns = [
    path("", ChatThreadListCreateView.as_view(), name="chat-list"),
    path("<int:thread_id>/", ChatThreadDetailView.as_view(), name="chat-detail"),
    path("<int:thread_id>/archive/", ChatThreadArchiveView.as_view(), name="chat-archive"),
    path("<int:thread_id>/trip/", ChatThreadTripView.as_view(), name="chat-trip"),
]

