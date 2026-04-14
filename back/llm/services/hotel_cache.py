"""
Hotel Caching Service

Caches hotel results from Booking.com RapidAPI.
Follows the same pattern as Google Places caching in this project.
"""

from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache


CACHE_HOURS = 6  # Hotel prices change, but not every minute


def get_cached_hotels(city: str, checkin: str, checkout: str, budget_per_night: float, adults: int = 1):
    """
    Get cached hotels for the given search parameters.
    Returns cached list if available and not expired, else None.

    Cache key format: hotels:{city}:{checkin}:{checkout}:{budget}:{adults}
    TTL: 6 hours
    """
    cache_key = build_hotel_cache_key(city, checkin, checkout, budget_per_night, adults)
    cached_data = cache.get(cache_key)

    if cached_data is not None:
        return cached_data

    return None


def cache_hotels(city: str, checkin: str, checkout: str, budget_per_night: float,
                hotels: list, adults: int = 1):
    """
    Cache hotel results for the given search parameters.
    Only caches non-empty results to avoid caching failures.

    Args:
        city: Destination city
        checkin: Check-in date (YYYY-MM-DD)
        checkout: Checkout date (YYYY-MM-DD)
        budget_per_night: Budget per night
        hotels: List of hotel dicts to cache
        adults: Number of adults
    """
    if not hotels:
        # Don't cache empty results (likely API failures)
        return

    cache_key = build_hotel_cache_key(city, checkin, checkout, budget_per_night, adults)
    timeout_seconds = CACHE_HOURS * 60 * 60

    cache.set(cache_key, hotels, timeout=timeout_seconds)


def build_hotel_cache_key(city: str, checkin: str, checkout: str,
                          budget_per_night: float, adults: int = 1) -> str:
    """
    Build a unique cache key for hotel search parameters.
    Format: hotels:{city_slug}:{checkin}:{checkout}:{budget}:{adults}
    """
    city_slug = city.lower().replace(" ", "_").replace("-", "_")
    budget_int = int(budget_per_night) if budget_per_night else 0
    return f"hotels:{city_slug}:{checkin}:{checkout}:{budget_int}:{adults}"


def get_hotels_cached(city_name: str, checkin: str, checkout: str,
                      budget_per_night: float, adults: int = 1,
                      children: int = 0, travel_style: str = None) -> list:
    """
    Returns cached hotels if available, otherwise fetches and caches.

    This is the main entry point for hotel searches with caching.
    Uses the booking_service to fetch data when not cached.
    """
    from .booking_service import search_hotels

    cache_key = build_hotel_cache_key(city_name, checkin, checkout, budget_per_night, adults)
    cached = cache.get(cache_key)

    if cached is not None:
        return cached

    # Fetch from API
    hotels = search_hotels(
        city_name=city_name,
        checkin=checkin,
        checkout=checkout,
        budget_per_night=budget_per_night,
        adults=adults,
        children=children,
        travel_style=travel_style,
    )

    # Only cache non-empty results
    if hotels:
        cache.set(cache_key, hotels, timeout=CACHE_HOURS * 60 * 60)

    return hotels


def clear_hotel_cache(city: str = None):
    """
    Clear hotel cache for a specific city or all cities.

    Args:
        city: If provided, clears only that city's cache.
              If None, clears all hotel caches.
    """
    if city:
        # Pattern-based deletion not directly supported in Django cache
        # Would need to track keys separately for per-city clearing
        cache.delete_pattern(f"hotels:{city.lower().replace(' ', '_')}:*")
    else:
        cache.delete_pattern("hotels:*")


def is_hotel_cached(city: str, checkin: str, checkout: str,
                    budget_per_night: float, adults: int = 1) -> bool:
    """
    Check if hotels are already cached for the given parameters.
    Returns True if cached, False otherwise.
    """
    cache_key = build_hotel_cache_key(city, checkin, checkout, budget_per_night, adults)
    return cache.get(cache_key) is not None
