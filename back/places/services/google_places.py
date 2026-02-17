import requests
from django.conf import settings
from places.services.cache import get_cached_places
from django.utils import timezone
from django.db.models import Q
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
            "places.location,"
            "places.priceLevel,"
            "places.regularOpeningHours,"
            "places.photos,"
            "places.websiteUri,"
            "places.addressComponents"
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


def _build_photo_url(photo, *, max_width=800, max_height=800):
    name = photo.get("name")
    if not name:
        return None
    return (
        f"https://places.googleapis.com/v1/{name}/media"
        f"?maxHeightPx={max_height}&maxWidthPx={max_width}"
        f"&key={settings.GOOGLE_MAPS_API_KEY}"
    )


def _extract_country(place):
    components = place.get("addressComponents", [])
    for component in components:
        if "country" in component.get("types", []):
            return component.get("longText") or component.get("shortText") or ""
    return ""


def _extract_neighborhood(place):
    components = place.get("addressComponents", [])

    for component in components:
        types = component.get("types", [])
        if "neighborhood" in types:
            return component.get("longText") or component.get("shortText")

    for fallback_type in (
        "sublocality",
        "sublocality_level_1",
        "sublocality_level_2",
        "locality",
    ):
        for component in components:
            if fallback_type in component.get("types", []):
                return component.get("longText") or component.get("shortText")

    return None


def save_places_to_db(places_data, city: str, category: str):
    saved_places = []

    for place in places_data:
        location = place.get("location", {})
        photos = place.get("photos", [])
        photo_url = _build_photo_url(photos[0]) if photos else None

        obj, _ = Place.objects.update_or_create(
            google_place_id=place["id"],
            defaults={
                "name": place["displayName"]["text"],
                "category": category,
                "types": place.get("types", []),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("userRatingCount"),
                "price_level": place.get("priceLevel"),
                "opening_hours": place.get("regularOpeningHours"),
                "photo_url": photo_url,
                "website": place.get("websiteUri"),
                "neighborhood": _extract_neighborhood(place),
                "address": place.get("formattedAddress", ""),
                "city": city,
                "country": _extract_country(place) or "",
                "lat": location.get("latitude"),
                "lng": location.get("longitude"),
            },
        )

        saved_places.append(obj)

    return saved_places


def get_places(city: str, category: str, max_results=10, force_refresh=False):
    cached = get_cached_places(city, category)

    if cached.exists() and not force_refresh:
        missing_fields = cached.filter(
            Q(price_level__isnull=True)
            | Q(opening_hours__isnull=True)
            | Q(photo_url__isnull=True)
            | Q(website__isnull=True)
            | Q(neighborhood__isnull=True)
        ).exists()
        if not missing_fields:
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
