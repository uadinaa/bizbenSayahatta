from django.utils import timezone
from rest_framework.exceptions import ValidationError

from marketplace.models import Trip, TripVersion
from users.models import User


def assert_tripadvisor_can_submit(user: User):
    if user.role not in {User.Role.TRIPADVISOR, User.Role.ADMIN}:
        raise ValidationError("Only TripAdvisor accounts can submit trips.")
    if user.subscription_status != User.SubscriptionStatus.ACTIVE:
        raise ValidationError("Active subscription is required to submit public trips.")


def create_trip_version(*, trip: Trip, actor: User):
    snapshot = {
        "title": trip.title,
        "destination": trip.destination,
        "duration_days": trip.duration_days,
        "available_dates": trip.available_dates,
        "booked_hotels": trip.booked_hotels,
        "restaurants": trip.restaurants,
        "itinerary_json": trip.itinerary_json,
        "included_services": trip.included_services,
        "advisor_advantages": trip.advisor_advantages,
        "price": str(trip.price),
        "social_links": trip.social_links,
        "map_route": trip.map_route,
        "media_urls": trip.media_urls,
        "status": trip.status,
        "visibility": trip.visibility,
    }
    TripVersion.objects.create(trip=trip, version=trip.version, snapshot=snapshot, created_by=actor)


def submit_trip_for_moderation(*, trip: Trip, actor: User):
    assert_tripadvisor_can_submit(actor)
    trip.status = Trip.STATUS_PENDING
    trip.submitted_at = timezone.now()
    trip.rejection_reason = ""
    trip.save(update_fields=["status", "submitted_at", "rejection_reason", "updated_at"])


def approve_trip(*, trip: Trip, manager: User):
    trip.status = Trip.STATUS_APPROVED
    trip.approved_by = manager
    trip.approved_at = timezone.now()
    trip.rejection_reason = ""
    trip.save(update_fields=["status", "approved_by", "approved_at", "rejection_reason", "updated_at"])


def reject_trip(*, trip: Trip, reason: str):
    trip.status = Trip.STATUS_REJECTED
    trip.rejection_reason = reason
    trip.save(update_fields=["status", "rejection_reason", "updated_at"])
