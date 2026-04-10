from django.urls import path

from .views import PlaceCommentLikeView, PlaceCommentListCreateView


urlpatterns = [
    path(
        "<int:place_id>/comments/<int:comment_id>/like/",
        PlaceCommentLikeView.as_view(),
        name="place-comment-like",
    ),
    path("<int:place_id>/comments/", PlaceCommentListCreateView.as_view(), name="place-comments"),
]

