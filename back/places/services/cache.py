from datetime import timedelta
from django.utils import timezone
from places.models import Place


CACHE_HOURS = 24


def get_cached_places(city: str, category: str):
    cutoff_time = timezone.now() - timedelta(hours=CACHE_HOURS)

    return Place.objects.filter(
        city__iexact=city,
        category__iexact=category,
        cached_at__gte=cutoff_time,
    )
