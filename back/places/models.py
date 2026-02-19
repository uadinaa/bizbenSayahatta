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
    price_level = models.CharField(max_length=30, null=True, blank=True)
    opening_hours = models.JSONField(null=True, blank=True)
    photo_url = models.URLField(null=True, blank=True, max_length=1000)
    website = models.URLField(null=True, blank=True, max_length=1000)
    neighborhood = models.CharField(max_length=100, null=True, blank=True)
    is_must_visit = models.BooleanField(default=False)

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


class InterestMapping(models.Model):
    name = models.CharField(max_length=100, unique=True)
    mappings = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name


class VisitedPlace(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="visited_places",
    )
    place = models.ForeignKey(
        "Place",
        on_delete=models.CASCADE,
        related_name="visited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "place")

    def __str__(self):
        return f"{self.user} visited {self.place}"


class MustVisitPlace(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="must_visit_places",
    )
    place = models.ForeignKey(
        "Place",
        on_delete=models.CASCADE,
        related_name="must_visit_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "place")

    def __str__(self):
        return f"{self.user} marked {self.place} as must visit"


class UserMapPlace(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="map_places",
    )
    city = models.CharField(max_length=120)
    country = models.CharField(max_length=120)
    date = models.CharField(max_length=20)
    lat = models.FloatField()
    lon = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user} map place {self.city}, {self.country}"
