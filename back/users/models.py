from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        USER = "USER", "User"
        TRIPADVISOR = "TRIPADVISOR", "TripAdvisor"
        MANAGER = "MANAGER", "Manager"
        ADMIN = "ADMIN", "Admin"

    class SubscriptionStatus(models.TextChoices):
        INACTIVE = "INACTIVE", "Inactive"
        ACTIVE = "ACTIVE", "Active"
        CANCELED = "CANCELED", "Canceled"

    username = models.CharField(max_length=150, blank=True)
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    cover = models.ImageField(upload_to="covers/", blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER, db_index=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False, db_index=True)
    block_expires_at = models.DateTimeField(null=True, blank=True)
    subscription_status = models.CharField(max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.INACTIVE)
    tokens = models.PositiveIntegerField(default=100)
    referral_code = models.CharField(max_length=32, unique=True, null=True, blank=True)
    ranking_score = models.FloatField(default=0)
    status_level = models.CharField(max_length=16, default="BRONZE")
    date_joined = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class UserPreferences(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preferences")
    budget = models.IntegerField(null=True, blank=True)
    travel_style = models.CharField(max_length=50, null=True, blank=True)
    open_now = models.BooleanField(null=True, blank=True)
    interests = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences for {self.user}"
