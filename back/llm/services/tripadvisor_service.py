"""
TripAdvisor Content API Service

Fetches tours, attractions, and experiences from TripAdvisor.
Follows the same structure as the Google Places service.
"""

import requests
from django.conf import settings
from django.core.cache import cache
from datetime import timedelta
from django.utils import timezone


TRIPADVISER_API_KEY = getattr(settings, 'TRIPADVISER_API_KEY', '')
BASE_URL = "https://api.tripadvisor.com/api/internal/1.14"

HEADERS = {
    "Accept": "application/json",
}


def fetch_tours_from_tripadvisor(city_name: str, max_results: int = 10) -> list:
    """
    Fetch tours/attractions from TripAdvisor Content API.

    Args:
        city_name: Destination city name
        max_results: Maximum number of results to return

    Returns:
        List of raw tour dicts from TripAdvisor API, or empty list on error
    """
    if not TRIPADVISER_API_KEY:
        print("TripAdvisor API key not configured")
        return []

    try:
        # First, search for the location to get location_id
        location_id = _get_location_id(city_name)
        if not location_id:
            print(f"Could not find location ID for {city_name}")
            return []

        # Fetch attractions/tours for this location
        url = f"{BASE_URL}/location/{location_id}/attractions"
        params = {
            "key": TRIPADVISER_API_KEY,
            "language": "en",
            "limit": max_results,
        }

        response = requests.get(url, headers=HEADERS, params=params, timeout=15)

        if response.status_code != 200:
            print(f"TripAdvisor API error: {response.status_code} - {response.text}")
            return []

        data = response.json()

        # Extract attractions list from response
        attractions = data.get("data", [])
        if isinstance(attractions, dict):
            attractions = attractions.get("attractions", [])

        return attractions if isinstance(attractions, list) else []

    except Exception as exc:
        print(f"TripAdvisor service error: {exc}")
        return []


def _get_location_id(city_name: str) -> str:
    """
    Search for a city and return its TripAdvisor location ID.
    Returns empty string if not found.
    """
    try:
        url = f"{BASE_URL}/location/search"
        params = {
            "key": TRIPADVISER_API_KEY,
            "query": city_name,
            "language": "en",
        }

        response = requests.get(url, headers=HEADERS, params=params, timeout=10)

        if response.status_code != 200:
            print(f"TripAdvisor location search error: {response.status_code}")
            return ""

        data = response.json()
        results = data.get("data", [])

        if isinstance(results, list) and len(results) > 0:
            # Return first result's location_id
            return str(results[0].get("location_id", ""))

        return ""

    except Exception as exc:
        print(f"TripAdvisor location search error: {exc}")
        return ""


def _normalize_tour(tour: dict, city: str) -> dict:
    """
    Normalize a TripAdvisor tour/attraction to our standard format.
    All TripAdvisor-specific fields default to None - never raise KeyError.

    Returns dict or None if invalid.
    """
    # Extract basic info with safe defaults
    name = tour.get("name") or tour.get("title", "")
    if not name:
        return None

    description = tour.get("description") or tour.get("web_url", "")

    # Price info
    price_info = tour.get("price", {}) or {}
    price_amount = price_info.get("amount") or tour.get("price_amount")
    price_currency = price_info.get("currency") or tour.get("currency", "USD")

    # Rating info
    rating = tour.get("rating") or tour.get("average_rating")
    num_reviews = tour.get("num_reviews") or tour.get("review_count", 0)

    # Photo/main image
    photo = tour.get("photo", {}) or {}
    photo_url = photo.get("images", {}).get("small", {}).get("url")
    if not photo_url:
        # Try alternative photo paths
        photo_url = (
            photo.get("images", {}).get("medium", {}).get("url")
            or photo.get("images", {}).get("large", {}).get("url")
            or photo.get("url")
            or tour.get("image_url")
        )

    # Web URL
    web_url = tour.get("web_url") or tour.get("booking_url", "")

    # TripAdvisor-specific extras (all default to None)
    duration = tour.get("duration") or tour.get("duration_text")
    booking_url = tour.get("booking_url") or tour.get("offer_url")
    category = tour.get("category", {}).get("name") if isinstance(tour.get("category"), dict) else tour.get("category")
    subcategory = None
    subcategory_data = tour.get("subcategory", [])
    if isinstance(subcategory_data, list) and len(subcategory_data) > 0:
        subcategory = subcategory_data[0].get("name") if isinstance(subcategory_data[0], dict) else subcategory_data[0]
    elif isinstance(subcategory_data, dict):
        subcategory = subcategory_data.get("name")

    # Award (e.g., Travelers' Choice)
    award = None
    awards_data = tour.get("awards", [])
    if isinstance(awards_data, list) and len(awards_data) > 0:
        award = awards_data[0].get("name") if isinstance(awards_data[0], dict) else awards_data[0]

    return {
        "id": str(tour.get("location_id", tour.get("id", ""))),
        "name": name,
        "description": description,
        "price_amount": float(price_amount) if price_amount else None,
        "price_currency": price_currency,
        "rating": float(rating) if rating else None,
        "num_reviews": int(num_reviews) if num_reviews else 0,
        "photo_url": photo_url,
        "web_url": web_url,
        "duration": duration,
        "booking_url": booking_url,
        "category": category,
        "subcategory": subcategory,
        "award": award,
        "city": city,
    }


def get_tours_cached(city: str, max_results: int = 10, force_refresh: bool = False) -> list:
    """
    Get tours for a city with caching.

    Caching pattern (matches Google Places structure):
    - Same cache backend (Django locmem cache)
    - Key format: tripadvisor:tours:{city_slug}
    - TTL: 12 hours (tours change less often than availability)
    - Don't cache empty results

    Args:
        city: Destination city name
        max_results: Maximum number of tours to return
        force_refresh: If True, skip cache and fetch from API

    Returns:
        List of normalized tour dicts, or empty list on error
    """
    city_slug = city.lower().replace(" ", "_").replace("-", "_")
    cache_key = f"tripadvisor:tours:{city_slug}"

    # Check cache first (unless force_refresh)
    if not force_refresh:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data

    # Fetch from TripAdvisor API
    raw_tours = fetch_tours_from_tripadvisor(city, max_results=max_results)

    # Normalize tours
    normalized_tours = []
    for tour in raw_tours:
        normalized = _normalize_tour(tour, city)
        if normalized:
            normalized_tours.append(normalized)

    # Only cache non-empty results
    if normalized_tours:
        timeout_seconds = 12 * 60 * 60  # 12 hours
        cache.set(cache_key, normalized_tours, timeout=timeout_seconds)
        print(f"Cached {len(normalized_tours)} tours for {city} (key: {cache_key})")
    else:
        print(f"No tours found for {city} - not caching empty result")

    return normalized_tours


def clear_tour_cache(city: str = None):
    """
    Clear tour cache for a specific city or all cities.

    Args:
        city: If provided, clears only that city's cache.
              If None, clears all TripAdvisor tour caches.
    """
    if city:
        city_slug = city.lower().replace(" ", "_").replace("-", "_")
        cache_key = f"tripadvisor:tours:{city_slug}"
        cache.delete(cache_key)
    else:
        cache.delete_pattern("tripadvisor:tours:*")


def is_tour_cached(city: str) -> bool:
    """
    Check if tours are already cached for the given city.
    Returns True if cached, False otherwise.
    """
    city_slug = city.lower().replace(" ", "_").replace("-", "_")
    cache_key = f"tripadvisor:tours:{city_slug}"
    return cache.get(cache_key) is not None
