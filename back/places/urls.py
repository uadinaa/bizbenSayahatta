from django.urls import path
from .views import (
    InspirationListAPIView,
    PlacesListAPIView,
    SavePlaceAPIView,
    WishlistAPIView,
    VisitPlaceAPIView,
    VisitedPlacesAPIView,
    PlaceMustVisitAPIView,
)

urlpatterns = [
    path("", PlacesListAPIView.as_view(), name="places-list"),
    path("inspiration/", InspirationListAPIView.as_view(), name="inspiration-list"),
    path("places/<int:place_id>/save/", SavePlaceAPIView.as_view(), name="place-save"),
    path("wishlist/", WishlistAPIView.as_view(), name="wishlist"),
    path("places/<int:place_id>/visited/", VisitPlaceAPIView.as_view(), name="place-visited"),
    path("visited/", VisitedPlacesAPIView.as_view(), name="visited-places"),
    path(
        "places/<int:place_id>/must-visit/",
        PlaceMustVisitAPIView.as_view(),
        name="place-must-visit",
    ),

]
