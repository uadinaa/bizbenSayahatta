from django.urls import path
from .views import InspirationListAPIView, PlacesListAPIView, SavePlaceAPIView

urlpatterns = [
    path("", PlacesListAPIView.as_view(), name="places-list"),
    path("inspiration/", InspirationListAPIView.as_view(), name="inspiration-list"),
    path("places/<int:place_id>/save/", SavePlaceAPIView.as_view(), name="place-save"),

]
