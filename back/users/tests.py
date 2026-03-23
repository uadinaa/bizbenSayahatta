from django.test import TestCase

from places.models import Place, UserMapPlace, VisitedPlace
from users.models import User, UserPreferences
from users.services import calculate_level_and_badges, sync_user_travel_profile


class TravelerProfileTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="traveler@example.com",
            password="testpass123",
        )
        UserPreferences.objects.create(user=self.user, travel_style="Food")

        places = [
            Place.objects.create(
                google_place_id="tokyo-1",
                name="Tokyo Museum",
                category="museum",
                types=["museum"],
                address="Tokyo",
                city="Tokyo",
                country="Japan",
                lat=35.68,
                lng=139.76,
            ),
            Place.objects.create(
                google_place_id="bangkok-1",
                name="Bangkok Market",
                category="restaurant",
                types=["restaurant"],
                address="Bangkok",
                city="Bangkok",
                country="Thailand",
                lat=13.75,
                lng=100.5,
            ),
            Place.objects.create(
                google_place_id="bali-1",
                name="Bali Beach",
                category="park",
                types=["park"],
                address="Bali",
                city="Bali",
                country="Indonesia",
                lat=-8.65,
                lng=115.22,
            ),
        ]

        for index, place in enumerate(places):
            UserMapPlace.objects.create(
                user=self.user,
                city=place.city,
                country=place.country,
                date=f"2025-0{index + 1}",
                lat=place.lat,
                lon=place.lng,
            )
            VisitedPlace.objects.create(user=self.user, place=place)

    def test_calculate_level_and_badges_uses_trip_history(self):
        profile = calculate_level_and_badges(self.user)

        self.assertEqual(profile["traveler_level"]["name"], "Voyager")
        self.assertTrue(any(badge["code"] == "asia_explorer" for badge in profile["badges"]))
        self.assertEqual(profile["history_summary"]["trip_count"], 3)

    def test_sync_user_travel_profile_persists_values(self):
        sync_user_travel_profile(self.user)
        prefs = self.user.preferences

        self.assertEqual(prefs.traveler_level, "Voyager")
        self.assertTrue(any(badge["code"] == "asia_explorer" for badge in prefs.badges))
