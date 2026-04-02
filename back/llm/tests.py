from django.urls import reverse
from rest_framework.test import APITestCase

from llm.models import ChatEntry, ChatThread, FinalTrip
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


class ChatThreadManagementTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="testpass123",
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.thread = ChatThread.objects.create(
            user=self.user,
            kind="planner",
            title="Almaty trip",
        )
        self.other_thread = ChatThread.objects.create(
            user=self.other_user,
            kind="planner",
            title="Other thread",
        )

    def test_trip_endpoint_returns_null_when_no_trip_exists(self):
        response = self.client.get(reverse("chat-thread-trip", args=[self.thread.id]))

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data)

    def test_trip_patch_creates_final_trip(self):
        payload = {
            "city": "Almaty",
            "country": "Kazakhstan",
            "itinerary": [
                {
                    "day": 1,
                    "summary": "Day 1: Kok Tobe, Green Bazaar",
                    "stops": [{"name": "Kok Tobe"}],
                }
            ],
            "route": [
                {
                    "day": 1,
                    "color": "#E53E3E",
                    "places": [{"name": "Kok Tobe", "lat": 43.233, "lng": 76.97}],
                }
            ],
            "response_markdown": "Final Trip for Almaty",
        }

        response = self.client.patch(
            reverse("chat-thread-trip", args=[self.thread.id]),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["city"], "Almaty")
        self.assertEqual(FinalTrip.objects.get(thread=self.thread).route[0]["day"], 1)

    def test_archive_filter_and_toggle(self):
        toggle_response = self.client.patch(reverse("chat-thread-archive", args=[self.thread.id]))
        self.assertEqual(toggle_response.status_code, 200)
        self.assertTrue(toggle_response.data["is_archived"])

        active_response = self.client.get(reverse("chat-threads"))
        self.assertEqual(active_response.status_code, 200)
        self.assertEqual(len(active_response.data), 0)

        archived_response = self.client.get(f"{reverse('chat-threads')}?archived=true")
        self.assertEqual(archived_response.status_code, 200)
        self.assertEqual(len(archived_response.data), 1)
        self.assertEqual(archived_response.data[0]["id"], self.thread.id)

    def test_delete_chat_cascades_messages_and_trip(self):
        ChatEntry.objects.create(thread=self.thread, role="user", content="hello")
        FinalTrip.objects.create(
            thread=self.thread,
            city="Almaty",
            itinerary=[],
            route=[],
            plan_snapshot={},
        )

        response = self.client.delete(reverse("chat-thread-detail", args=[self.thread.id]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(ChatThread.objects.filter(id=self.thread.id).exists())
        self.assertFalse(ChatEntry.objects.filter(thread_id=self.thread.id).exists())
        self.assertFalse(FinalTrip.objects.filter(thread_id=self.thread.id).exists())

    def test_other_user_cannot_archive_or_delete_or_view_trip(self):
        archive_response = self.client.patch(reverse("chat-thread-archive", args=[self.other_thread.id]))
        delete_response = self.client.delete(reverse("chat-thread-detail", args=[self.other_thread.id]))
        trip_response = self.client.get(reverse("chat-thread-trip", args=[self.other_thread.id]))

        self.assertEqual(archive_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.assertEqual(trip_response.status_code, 403)
