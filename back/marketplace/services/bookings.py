from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from marketplace.models import Trip, TripBooking
from users.models import User


def check_trip_availability(trip: Trip, number_of_travelers: int) -> tuple[bool, int]:
    """
    Check if trip has availability for the requested number of travelers.

    Returns:
        tuple: (is_available, available_spots)
    """
    available_spots = trip.max_travelers - trip.current_bookings
    is_available = number_of_travelers <= available_spots
    return is_available, available_spots


def assert_user_can_book_trip(trip: Trip, user: User) -> None:
    """
    Validate that user can book the trip.

    Raises:
        ValidationError: If user cannot book the trip.
    """
    # Check trip status
    if trip.status != Trip.STATUS_APPROVED:
        raise ValidationError("This trip is not available for booking.")

    # Check visibility
    if trip.visibility != Trip.VISIBILITY_PUBLIC:
        raise ValidationError("This trip is not publicly available.")

    # Check if user already has an active booking
    existing_booking = TripBooking.objects.filter(
        trip=trip,
        user=user,
        status__in=[TripBooking.STATUS_PENDING, TripBooking.STATUS_CONFIRMED],
    ).first()

    if existing_booking:
        raise ValidationError("You already have an active booking for this trip.")


@transaction.atomic
def book_trip(*, trip: Trip, user: User, number_of_travelers: int = 1) -> TripBooking:
    """
    Book a trip for a user.

    Args:
        trip: The trip to book
        user: The user making the booking
        number_of_travelers: Number of travelers (default: 1)

    Returns:
        TripBooking: The created booking

    Raises:
        ValidationError: If booking cannot be made
    """
    # Check availability
    is_available, available_spots = check_trip_availability(trip, number_of_travelers)
    if not is_available:
        raise ValidationError(
            f"Only {available_spots} spots available for this trip. "
            f"You requested {number_of_travelers}."
        )

    # Check user eligibility
    assert_user_can_book_trip(trip, user)

    # Create the booking
    booking = TripBooking.objects.create(
        trip=trip,
        user=user,
        number_of_travelers=number_of_travelers,
        status=TripBooking.STATUS_PENDING,
    )

    # Update trip's current_bookings count
    Trip.objects.filter(pk=trip.pk).update(
        current_bookings=trip.current_bookings + number_of_travelers
    )

    return booking


@transaction.atomic
def cancel_booking(*, booking: TripBooking, cancel_reason: str = "", cancelled_by: User = None) -> TripBooking:
    """
    Cancel a trip booking.

    Args:
        booking: The booking to cancel
        cancel_reason: Reason for cancellation
        cancelled_by: User who cancelled the booking

    Returns:
        TripBooking: The updated booking
    """
    if booking.status in [TripBooking.STATUS_CANCELLED, TripBooking.STATUS_COMPLETED]:
        raise ValidationError("This booking has already been cancelled or completed.")

    # Update booking status
    booking.status = TripBooking.STATUS_CANCELLED
    booking.cancellation_reason = cancel_reason
    booking.cancelled_by = cancelled_by
    booking.cancelled_at = timezone.now()
    booking.save(update_fields=["status", "cancellation_reason", "cancelled_by", "cancelled_at"])

    # Update trip's current_bookings count
    trip = booking.trip
    Trip.objects.filter(pk=trip.pk).update(
        current_bookings=max(0, trip.current_bookings - booking.number_of_travelers)
    )

    return booking


@transaction.atomic
def confirm_booking(*, booking: TripBooking) -> TripBooking:
    """
    Confirm a pending booking.

    Args:
        booking: The booking to confirm

    Returns:
        TripBooking: The updated booking
    """
    if booking.status != TripBooking.STATUS_PENDING:
        raise ValidationError("Only pending bookings can be confirmed.")

    booking.status = TripBooking.STATUS_CONFIRMED
    booking.confirmed_at = timezone.now()
    booking.save(update_fields=["status", "confirmed_at"])

    return booking


@transaction.atomic
def complete_booking(*, booking: TripBooking) -> TripBooking:
    """
    Mark a booking as completed (after trip ends).

    Args:
        booking: The booking to complete

    Returns:
        TripBooking: The updated booking
    """
    if booking.status not in [TripBooking.STATUS_PENDING, TripBooking.STATUS_CONFIRMED]:
        raise ValidationError("Only pending or confirmed bookings can be completed.")

    booking.status = TripBooking.STATUS_COMPLETED
    booking.save(update_fields=["status", "updated_at"])

    return booking


def get_user_bookings(user: User, status_filter: str = None):
    """
    Get all bookings for a user.

    Args:
        user: The user to get bookings for
        status_filter: Optional status filter

    Returns:
        QuerySet: User's bookings
    """
    qs = TripBooking.objects.filter(user=user).select_related("trip", "trip__category")

    if status_filter:
        qs = qs.filter(status=status_filter)

    return qs.order_by("-booked_at")


def get_trip_bookings(trip: Trip, status_filter: str = None):
    """
    Get all bookings for a trip (for advisor view).

    Args:
        trip: The trip to get bookings for
        status_filter: Optional status filter

    Returns:
        QuerySet: Trip's bookings
    """
    qs = TripBooking.objects.filter(trip=trip).select_related("user")

    if status_filter:
        qs = qs.filter(status=status_filter)

    return qs.order_by("-booked_at")
