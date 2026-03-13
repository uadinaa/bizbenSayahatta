from django.urls import path

from .views import PlaceCommentListCreateView


urlpatterns = [
    path("<int:place_id>/comments/", PlaceCommentListCreateView.as_view(), name="place-comments"),
]

