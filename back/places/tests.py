from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from places.models import MustVisitPlace, Place, SavedPlace
from users.models import User


class WishlistFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="wishlist@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)
        self.place = Place.objects.create(
            google_place_id="wishlist-place-1",
            name="Wishlist Place",
            category="museum",
            types=["museum"],
            address="Test Address",
            city="Almaty",
            country="Kazakhstan",
            lat=43.2389,
            lng=76.8897,
        )

    def test_must_visit_toggle_adds_to_both_favorite_tables(self):
        response = self.client.post(
            f"/api/places/places/{self.place.id}/must-visit/",
            {"is_must_visit": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(MustVisitPlace.objects.filter(user=self.user, place=self.place).exists())
        self.assertTrue(SavedPlace.objects.filter(user=self.user, place=self.place).exists())
        self.place.refresh_from_db()
        self.assertEqual(self.place.saves_count, 1)

    def test_must_visit_toggle_remove_clears_both_favorite_tables(self):
        MustVisitPlace.objects.create(user=self.user, place=self.place)
        SavedPlace.objects.create(user=self.user, place=self.place)
        self.place.saves_count = 1
        self.place.save(update_fields=["saves_count"])

        response = self.client.post(
            f"/api/places/places/{self.place.id}/must-visit/",
            {"is_must_visit": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(MustVisitPlace.objects.filter(user=self.user, place=self.place).exists())
        self.assertFalse(SavedPlace.objects.filter(user=self.user, place=self.place).exists())
        self.place.refresh_from_db()
        self.assertEqual(self.place.saves_count, 0)

    def test_wishlist_endpoint_returns_places_from_must_visit_records(self):
        MustVisitPlace.objects.create(user=self.user, place=self.place)

        response = self.client.get("/api/places/wishlist/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.place.id)
        self.assertTrue(response.data[0]["is_must_visit"])

    def test_inspiration_serializer_treats_legacy_saved_place_as_favorited(self):
        SavedPlace.objects.create(user=self.user, place=self.place)

        response = self.client.get("/api/places/inspiration/?page=1")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["places"][0]["id"], self.place.id)
        self.assertTrue(response.data["places"][0]["is_must_visit"])
        self.assertIn("tours", response.data)
        self.assertIn("events", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
