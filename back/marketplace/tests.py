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

        trip = Trip.objects.create(
            advisor=self.trip_advisor,
            category=self.category,
            title="Tokyo Food Tour",
            destination="Tokyo",
            duration_days=3,
            visibility=Trip.VISIBILITY_PUBLIC,
            status=Trip.STATUS_DRAFT,
        )

        self.client.force_authenticate(user=self.trip_advisor)
        response = self.client.post(f"/api/marketplace/advisor/trips/{trip.id}/submit/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
