from django.urls import reverse
from rest_framework.test import APITestCase

from llm.models import ChatThread
from places.models import Place
from users.models import User, UserPreferences


class TravelChatFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="chat@example.com",
            password="testpass123",
        )
        UserPreferences.objects.create(user=self.user, citizenship="Russia")
        self.client.force_authenticate(self.user)

        self.thread = ChatThread.objects.create(
            user=self.user,
            kind="planner",
            title="Tokyo trip",
        )

        self._create_city_places("Tokyo", "Japan")
        self._create_city_places("Bali", "Indonesia")
        self._create_city_places("Bangkok", "Thailand")
        self._create_city_places("New York", "United States")

    def _create_city_places(self, city, country):
        categories = [
            ("museum", ["museum"]),
            ("restaurant", ["restaurant"]),
            ("park", ["park"]),
            ("tourist_attraction", ["tourist_attraction"]),
        ]
        for index, (category, types) in enumerate(categories, start=1):
            Place.objects.create(
                google_place_id=f"{city.lower()}-{index}",
                name=f"{city} Stop {index}",
                category=category,
                types=types,
                address=f"{index} {city} Street",
                city=city,
                country=country,
                lat=35.0 + index,
                lng=139.0 + index,
                rating=4.5,
                user_ratings_total=100 + index,
            )

    def test_incomplete_first_message_requests_only_missing_details(self):
        response = self.client.post(
            reverse("chat-thread-messages", args=[self.thread.id]),
            {"message": "I want to go to Bali"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("What's your total budget", response.data["response"])
        self.assertNotIn("Final Trip", response.data["response"])

    def test_family_trip_generates_family_note(self):
        response = self.client.post(
            reverse("chat-thread-messages", args=[self.thread.id]),
            {
                "message": "Trip to Tokyo for me, my wife and our 5-year-old, $3000, 7 days, family with kids, culture mix"
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Family-friendly filters applied", response.data["response"])
        self.assertEqual(response.data["plan"]["traveler_type"], "family")
        self.assertTrue(response.data["plan"]["route"][0]["places"])

    def test_sources_include_visa_requirement(self):
        response = self.client.post(
            reverse("chat-thread-messages", args=[self.thread.id]),
            {
                "message": "Trip to New York for 2 people, couple trip, $4000, 5 days, culture, Russian passport"
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan"]["sources"]["visa"]["status"], "required")
        self.assertIn("travel.state.gov", response.data["plan"]["sources"]["visa"]["url"])

    def test_thailand_trip_includes_destination_specific_safety_tip(self):
        response = self.client.post(
            reverse("chat-thread-messages", args=[self.thread.id]),
            {
                "message": "Trip to Bangkok for 2 people, couple trip, $2500, 4 days, food"
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        joined = " ".join(response.data["plan"]["safety_tips"]).lower()
        self.assertIn("street-food", joined)
