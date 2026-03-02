from django.conf import settings
from django.db import models
from django.utils import timezone

from places.models import Place


class AdvisorCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]


class TripAdvisorApplication(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"
    STATUS_MORE_INFO = "MORE_INFO"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_MORE_INFO, "More info required"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="advisor_applications")
    contract_accepted = models.BooleanField(default=False)
    terms_accepted = models.BooleanField(default=False)
    subscription_plan = models.CharField(max_length=50, blank=True)
    payment_reference = models.CharField(max_length=128, blank=True)
    cv_file = models.FileField(upload_to="advisor_cvs/", null=True, blank=True)
    portfolio_links = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_advisor_applications",
    )
    review_reason = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class TripAdvisorProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trip_advisor_profile")
    categories = models.ManyToManyField(AdvisorCategory, related_name="advisors", blank=True)
    description = models.TextField(blank=True)
    social_links = models.JSONField(default=dict, blank=True)
    verified = models.BooleanField(default=False)
    rating = models.FloatField(default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    completed_trips = models.PositiveIntegerField(default=0)
    engagement_score = models.FloatField(default=0)
    trust_score = models.FloatField(default=100)
    ranking_score = models.FloatField(default=0, db_index=True)
    status_level = models.CharField(max_length=16, default="BRONZE")
    violation_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class UserRestriction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="restrictions")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="issued_restrictions")
    reason = models.CharField(max_length=32, default="policy")
    details = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def has_expired(self):
        return self.expires_at is not None and timezone.now() >= self.expires_at


class Trip(models.Model):
    STATUS_DRAFT = "DRAFT"
    STATUS_PENDING = "PENDING"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PENDING, "Pending moderation"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    VISIBILITY_PUBLIC = "PUBLIC"
    VISIBILITY_PRIVATE = "PRIVATE"
    VISIBILITY_CHOICES = [(VISIBILITY_PUBLIC, "Public"), (VISIBILITY_PRIVATE, "Private")]

    advisor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="advisor_trips")
    title = models.CharField(max_length=255)
    category = models.ForeignKey(AdvisorCategory, on_delete=models.PROTECT, related_name="trips")
    destination = models.CharField(max_length=120)
    duration_days = models.PositiveIntegerField(default=1)
    available_dates = models.JSONField(default=list, blank=True)
    booked_hotels = models.JSONField(default=list, blank=True)
    restaurants = models.JSONField(default=list, blank=True)
    itinerary_json = models.JSONField(default=dict, blank=True)
    included_services = models.JSONField(default=list, blank=True)
    advisor_advantages = models.JSONField(default=list, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    social_links = models.JSONField(default=dict, blank=True)
    map_route = models.JSONField(default=dict, blank=True)
    media_urls = models.JSONField(default=list, blank=True)
    customer_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="private_customer_trips")
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PRIVATE)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    rating = models.FloatField(default=0)
    review_count = models.PositiveIntegerField(default=0)
    rejection_reason = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_trips")
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "visibility", "rating"]),
            models.Index(fields=["advisor", "status"]),
        ]


class TripVersion(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="trip_versions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("trip", "version")
        ordering = ["-created_at"]


class WishlistFolder(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist_folders")
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "name")
        ordering = ["name"]


class WishlistItem(models.Model):
    folder = models.ForeignKey(WishlistFolder, on_delete=models.CASCADE, related_name="items")
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="wishlist_items")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("folder", "place")


class ReferralReward(models.Model):
    referrer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="referral_rewards_received")
    referred_user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="referral_reward_origin")
    tokens_awarded = models.PositiveIntegerField(default=1000)
    valid_signup = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ModerationLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="moderation_actions")
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="moderation_targeted")
    trip = models.ForeignKey(Trip, on_delete=models.SET_NULL, null=True, blank=True, related_name="moderation_logs")
    application = models.ForeignKey(TripAdvisorApplication, on_delete=models.SET_NULL, null=True, blank=True, related_name="moderation_logs")
    action = models.CharField(max_length=64, db_index=True)
    reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class SubscriptionEvent(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription_events")
    provider = models.CharField(max_length=40, default="manual")
    external_event_id = models.CharField(max_length=128, blank=True, db_index=True)
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
