import requests
from django.conf import settings
from places.services.cache import get_cached_places
from django.utils import timezone
from places.models import Place


GOOGLE_PLACES_TEXT_SEARCH_URL = (
    "https://places.googleapis.com/v1/places:searchText"
)


def fetch_places_from_google(
    *,
    city: str,
    category: str,
    max_results: int = 10,
):
    """
    Fetch places from Google Places API (New)
    category examples: restaurant, museum, tourist_attraction
    """

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
        # VERY IMPORTANT: request only fields you need (cheaper)
        "X-Goog-FieldMask": (
            "places.id,"
            "places.displayName,"
            "places.types,"
            "places.rating,"
            "places.userRatingCount,"
            "places.formattedAddress,"
            "places.location"
        ),
    }

    body = {
        "textQuery": f"{category} in {city}",
        "maxResultCount": max_results,
    }

    response = requests.post(
        GOOGLE_PLACES_TEXT_SEARCH_URL,
        headers=headers,
        json=body,
        timeout=10,
    )

    response.raise_for_status()

    data = response.json()
    return data.get("places", [])



def save_places_to_db(places_data, city: str, category: str):
    saved_places = []

    for place in places_data:
        location = place.get("location", {})

        obj, _ = Place.objects.update_or_create(
            google_place_id=place["id"],
            defaults={
                "name": place["displayName"]["text"],
                "category": category,
                "types": place.get("types", []),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("userRatingCount"),
                "address": place.get("formattedAddress", ""),
                "city": city,
                "lat": location.get("latitude"),
                "lng": location.get("longitude"),
            },
        )

        saved_places.append(obj)

    return saved_places


def get_places(city: str, category: str, max_results=10):
    cached = get_cached_places(city, category)

    if cached.exists():
        return cached

    data = fetch_places_from_google(
        city=city,
        category=category,
        max_results=max_results,
    )

    places = save_places_to_db(data, city, category)

    Place.objects.filter(
        city__iexact=city,
        category__iexact=category,
    ).update(cached_at=timezone.now())

    return places
