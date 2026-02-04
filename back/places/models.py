from django.db import models
from django.utils import timezone
from django.conf import settings
from django.db import models
User = settings.AUTH_USER_MODEL


class Place(models.Model):
    google_place_id = models.CharField(
        max_length=255,
        unique=True,
        db_index=True
    )

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)

    types = models.JSONField(default=list)
    rating = models.FloatField(null=True, blank=True)
    user_ratings_total = models.IntegerField(null=True, blank=True)

    address = models.TextField()
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)

    lat = models.FloatField()
    lng = models.FloatField()

    status = models.CharField(
        max_length=20,
        choices=[
            ("trending", "Trending"),
            ("popular", "Popular"),
            ("hidden", "Hidden gem"),
        ],
        null=True,
        blank=True,
    )
    
    saves_count = models.PositiveIntegerField(default=0)

    # cached_at = models.DateTimeField(auto_now=True)
    cached_at = models.DateTimeField(default=timezone.now)


    class Meta:
        indexes = [
            models.Index(fields=["city", "category"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.city})"


class PlaceSearchCache(models.Model):
    city = models.CharField(max_length=100)
    category = models.CharField(max_length=50)

    last_fetched = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("city", "category")

    def __str__(self):
        return f"{self.city} - {self.category}"


class SavedPlace(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="saved_places"
    )
    place = models.ForeignKey(
        "Place",
        on_delete=models.CASCADE,
        related_name="saved_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "place")  # user can save once

    def __str__(self):
        return f"{self.user} saved {self.place}"
