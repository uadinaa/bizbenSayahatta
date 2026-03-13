import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User
from marketplace.models import AdvisorCategory, TripAdvisorApplication, Trip


class MarketplaceRBACAndWorkflowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="user@test.com", password="Password123")
        self.trip_advisor = User.objects.create_user(
            email="advisor@test.com",
            password="Password123",
            role=User.Role.TRIPADVISOR,
            subscription_status=User.SubscriptionStatus.ACTIVE,
        )
        self.manager = User.objects.create_user(
            email="manager@test.com",
            password="Password123",
            role=User.Role.MANAGER,
        )
        self.category = AdvisorCategory.objects.create(name="Hiking", slug="hiking")

    def test_regular_user_cannot_create_advisor_trip(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/marketplace/advisor/trips/",
            {
                "title": "Japan Explorer",
                "category_id": self.category.id,
                "destination": "Tokyo",
                "duration_days": 5,
                "price": "1200.00",
                "visibility": "PUBLIC",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_approve_tripadvisor_application(self):
        application = TripAdvisorApplication.objects.create(
            user=self.user,
            contract_accepted=True,
            terms_accepted=True,
            status=TripAdvisorApplication.STATUS_PENDING,
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(
            f"/api/marketplace/manager/applications/{application.id}/review/",
            {"status": "APPROVED", "reason": "Verified credentials"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, User.Role.TRIPADVISOR)

    def test_tripadvisor_public_submission_requires_active_subscription(self):
        self.trip_advisor.subscription_status = User.SubscriptionStatus.INACTIVE
        self.trip_advisor.save(update_fields=["subscription_status"])

        self.client.force_authenticate(user=self.trip_advisor)
        for idx in range(2):
            trip = Trip.objects.create(
                advisor=self.trip_advisor,
                category=self.category,
                title=f"Tokyo Food Tour {idx}",
                destination="Tokyo",
                duration_days=3,
                visibility=Trip.VISIBILITY_PUBLIC,
                status=Trip.STATUS_DRAFT,
            )
            response = self.client.post(f"/api/marketplace/advisor/trips/{trip.id}/submit/", {}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        third = Trip.objects.create(
            advisor=self.trip_advisor,
            category=self.category,
            title="Tokyo Food Tour 3",
            destination="Tokyo",
            duration_days=3,
            visibility=Trip.VISIBILITY_PUBLIC,
            status=Trip.STATUS_DRAFT,
        )
        response = self.client.post(f"/api/marketplace/advisor/trips/{third.id}/submit/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_manager_can_moderate_trip(self):
        trip = Trip.objects.create(
            advisor=self.trip_advisor,
            category=self.category,
            title="Almaty Explorer",
            destination="Almaty",
            duration_days=2,
            visibility=Trip.VISIBILITY_PUBLIC,
            status=Trip.STATUS_PENDING,
        )

        self.client.force_authenticate(user=self.manager)
        queue = self.client.get("/api/marketplace/manager/trips/queue/")
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        results = queue.data.get("results", queue.data)
        self.assertTrue(any(item["id"] == trip.id for item in results))

        approve = self.client.post(
            f"/api/marketplace/manager/trips/{trip.id}/moderate/",
            {"status": Trip.STATUS_APPROVED},
            format="json",
        )
        self.assertEqual(approve.status_code, status.HTTP_200_OK)
        trip.refresh_from_db()
        self.assertEqual(trip.status, Trip.STATUS_APPROVED)

    def test_tripadvisor_can_create_trip(self):
        self.client.force_authenticate(user=self.trip_advisor)
        response = self.client.post(
            "/api/marketplace/advisor/trips/",
            {
                "title": "Weekend Escape",
                "category_id": self.category.id,
                "destination": "Almaty",
                "duration_days": 2,
                "price": "250.00",
                "visibility": Trip.VISIBILITY_PUBLIC,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class TripMediaUploadTests(APITestCase):
    def setUp(self):
        self.trip_advisor = User.objects.create_user(
            email="advisor-media@test.com",
            password="Password123",
            role=User.Role.TRIPADVISOR,
            subscription_status=User.SubscriptionStatus.ACTIVE,
        )
        self.category = AdvisorCategory.objects.create(name="Concert", slug="concert")
        self.trip = Trip.objects.create(
            advisor=self.trip_advisor,
            category=self.category,
            title="Concert Weekend",
            destination="Seoul",
            duration_days=2,
            visibility=Trip.VISIBILITY_PUBLIC,
            status=Trip.STATUS_DRAFT,
        )

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_trip_media_upload(self):
        self.client.force_authenticate(user=self.trip_advisor)
        payload = {
            "file": SimpleUploadedFile("trip.jpg", b"filecontent", content_type="image/jpeg")
        }
        response = self.client.post(
            f"/api/marketplace/advisor/trips/{self.trip.id}/media/",
            payload,
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.trip.refresh_from_db()
        self.assertTrue(len(self.trip.media_urls) >= 1)
