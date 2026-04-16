from django.urls import path
from .views import (
    InspirationListAPIView,
    PlacesListAPIView,
    SavePlaceAPIView,
    WishlistAPIView,
    VisitPlaceAPIView,
    VisitedPlacesAPIView,
    PlaceMustVisitAPIView,
    ExternalPlaceMustVisitAPIView,
    UserMapPlaceListCreateAPIView,
    UserMapPlaceDeleteAPIView,
    UserPublicMapAPIView,
    UserPublicMapMarkersAPIView,
    UsersWithPublicMapListAPIView,
    HotelsSearchAPIView,
)

urlpatterns = [
    path("", PlacesListAPIView.as_view(), name="places-list"),
    path("inspiration/", InspirationListAPIView.as_view(), name="inspiration-list"),
    path("<int:place_id>/save/", SavePlaceAPIView.as_view(), name="place-save"),
    path("wishlist/", WishlistAPIView.as_view(), name="wishlist"),
    path("<int:place_id>/visited/", VisitPlaceAPIView.as_view(), name="place-visited"),
    path("visited/", VisitedPlacesAPIView.as_view(), name="visited-places"),
    path(
        "<int:place_id>/must-visit/",
        PlaceMustVisitAPIView.as_view(),
        name="place-must-visit",
    ),
    path(
        "external/must-visit/",
        ExternalPlaceMustVisitAPIView.as_view(),
        name="external-place-must-visit",
    ),
    path("map-places/", UserMapPlaceListCreateAPIView.as_view(), name="map-places"),
    path("map-places/<int:place_id>/", UserMapPlaceDeleteAPIView.as_view(), name="map-place-delete"),
    path("users/shared-maps/", UsersWithPublicMapListAPIView.as_view(), name="users-with-public-map"),
    path("users/<int:user_id>/map/markers/", UserPublicMapMarkersAPIView.as_view(), name="user-public-map-markers"),
    path(
        "users/by-username/<str:username>/map/markers/",
        UserPublicMapMarkersAPIView.as_view(),
        name="user-public-map-markers-by-username",
    ),
    path("map/<int:user_id>/markers/", UserPublicMapMarkersAPIView.as_view(), name="public-map-markers-short"),
    path("users/<int:user_id>/map/", UserPublicMapAPIView.as_view(), name="user-public-map"),
    path("hotels/search/", HotelsSearchAPIView.as_view(), name="hotels-search"),
]
