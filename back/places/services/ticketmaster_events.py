"""
Ticketmaster Service

Fetches event, attractions, and experiences from Ticketmaster via Ticketmaster Api.
Uses database caching (CachedEvent model) with in-memory cache as a secondary layer.

Endpoints:
- GET /discovery/v2/events
- GET /discovery/v2/events/{id}
"""

import requests
import re
from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from places.models import CachedEvent, CacheMetadata


TICKETMASTER_API_KEY = getattr(settings, 'TICKETMASTER_API_KEY', '')
TICKETMASTER_HOST = "app.ticketmaster.com"



def fetch_events_from_ticketmaster(city: str, size: int = 20):
    url = "https://app.ticketmaster.com/discovery/v2/events.json"

    params = {
        "apikey": TICKETMASTER_API_KEY,
        "city": city,
        "size": size,
        "sort": "date,asc"
    }

    response = requests.get(url, params=params, timeout=30)

    if response.status_code != 200:
        print("Error:", response.status_code, response.text)
        return []

    data = response.json()

    events = data.get("_embedded", {}).get("events", [])
    print(f"Found {len(events)} events in {city}")

    return events


def _normalize_event(event: dict, city: str) -> dict:
    name = event.get("name")
    if not name:
        return None

    # Dates
    dates = event.get("dates", {}).get("start", {})
    start_date = dates.get("dateTime") or dates.get("localDate")

    # Price (optional)
    price_ranges = event.get("priceRanges") or []
    price_amount = None
    price_currency = "USD"

    if price_ranges:
        price_amount = price_ranges[0].get("min")
        price_currency = price_ranges[0].get("currency", "USD")

    # Image
    images = event.get("images", [])
    photo_url = images[0]["url"] if images else ""

    # Venue
    venues = event.get("_embedded", {}).get("venues", [])
    venue_name = venues[0]["name"] if venues else ""

    return {
        "id": event.get("id"),
        "name": name,
        "description": "",  # Ticketmaster usually doesn’t provide description
        "price_amount": price_amount,
        "price_currency": price_currency,
        "rating": None,  # not available
        "num_reviews": 0,
        "photo_url": photo_url,
        "web_url": event.get("url"),
        "duration": "",
        "booking_url": event.get("url"),
        "category": event.get("classifications", [{}])[0].get("segment", {}).get("name", ""),
        "subcategory": event.get("classifications", [{}])[0].get("genre", {}).get("name", ""),
        "award": None,
        "city": city,
        "venue": venue_name,
        "start_date": start_date,
    }


def get_events_cached(city: str, size: int = 20, force_refresh: bool = False):
    """
    Get events for a city with database caching.

    Caching strategy:
    - Primary: Database (CachedEvent model) - persists across server restarts
    - Secondary: In-memory cache for fast repeated access within session
    - CacheMetadata tracks when data was last fetched and if it has data

    Args:
        city: Destination city name
        size: Maximum number of events to return
        force_refresh: If True, skip cache and fetch from API

    Returns:
        List of normalized event dicts, or empty list on error
    """
    city_slug = city.lower().replace(" ", "_")
    cache_key = f"ticketmaster:events:{city_slug}"

    # Check in-memory cache first (unless force_refresh)
    if not force_refresh:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            if isinstance(cached_data, dict) and cached_data.get('error'):
                print(f"Using cached API error for {city} (retry in 24 hours)")
                return []
            return cached_data

    # Check database cache first (unless force_refresh)
    if not force_refresh:
        db_events = CachedEvent.objects.filter(city=city, source="ticketmaster")[:size]
        if db_events.exists():
            # Convert database objects to dicts
            events_list = [
                {
                    "id": event.external_id,
                    "name": event.name,
                    "description": event.description,
                    "price_amount": event.price_amount,
                    "price_currency": event.price_currency,
                    "rating": event.rating,
                    "num_reviews": event.num_reviews,
                    "photo_url": event.photo_url,
                    "web_url": event.web_url,
                    "duration": event.duration,
                    "booking_url": event.booking_url,
                    "category": event.category,
                    "subcategory": event.subcategory,
                    "award": None,
                    "city": event.city,
                    "venue": event.venue,
                    "start_date": event.start_date,
                }
                for event in db_events
            ]
            # Also update in-memory cache
            cache.set(cache_key, events_list, timeout=30 * 60)  # 30 min in-memory
            print(f"Loaded {len(events_list)} events for {city} from database cache")
            return events_list

        # Check metadata to see if we already tried fetching and found nothing
        try:
            metadata = CacheMetadata.objects.get(city=city_slug, source="ticketmaster")
            if not metadata.has_data:
                # Check if 24 hours have passed since last fetch
                hours_since_fetch = (timezone.now() - metadata.last_fetched).total_seconds() / 3600
                if hours_since_fetch < 24:
                    print(f"Using cached metadata: no events for {city} (retry in {24 - hours_since_fetch:.1f} hours)")
                    return []
        except CacheMetadata.DoesNotExist:
            pass  # First time fetching this city, continue to API

    raw_events = fetch_events_from_ticketmaster(city, size=size)

    if not raw_events:
        # Update cache metadata to track failed fetch
        metadata, _ = CacheMetadata.objects.get_or_create(
            city=city_slug, source="ticketmaster", defaults={"has_data": False}
        )
        metadata.has_data = False
        metadata.save()

        # Cache empty result in-memory for 24 hours
        cache.set(cache_key, [], timeout=24 * 60 * 60)
        print(f"No events found for {city} - cached in database (no data) and memory for 24 hours")
        return []

    normalized_events = []
    for event in raw_events:
        norm = _normalize_event(event, city)
        if norm:
            normalized_events.append(norm)

    # Store in database
    if normalized_events:
        # Clear existing cached events for this city
        CachedEvent.objects.filter(city=city, source="ticketmaster").delete()

        # Bulk create new events
        events_to_create = []
        for event in normalized_events:
            events_to_create.append(CachedEvent(
                external_id=event["id"] or f"{city_slug}_{event['name'][:50]}",
                source="ticketmaster",
                city=city,
                name=event["name"],
                description=event["description"],
                category=event["category"],
                subcategory=event["subcategory"],
                venue=event.get("venue", ""),
                start_date=event.get("start_date", ""),
                rating=event["rating"],
                num_reviews=event["num_reviews"],
                price_amount=event["price_amount"],
                price_currency=event["price_currency"],
                photo_url=event["photo_url"],
                web_url=event["web_url"],
                booking_url=event["booking_url"],
                duration=event["duration"],
            ))

        if events_to_create:
            CachedEvent.objects.bulk_create(events_to_create)

        # Update metadata
        metadata, _ = CacheMetadata.objects.get_or_create(
            city=city_slug, source="ticketmaster", defaults={"has_data": True}
        )
        metadata.has_data = True
        metadata.save()

        # Update in-memory cache
        cache.set(cache_key, normalized_events, timeout=24 * 60 * 60)
        print(f"Cached {len(normalized_events)} events for {city} in database and memory (24 hours)")
    else:
        # Normalize returned nothing - update metadata
        metadata, _ = CacheMetadata.objects.get_or_create(
            city=city_slug, source="ticketmaster", defaults={"has_data": False}
        )
        metadata.has_data = False
        metadata.save()

        cache.set(cache_key, [], timeout=24 * 60 * 60)
        print(f"No valid events after normalization for {city} - cached in database and memory (24 hours)")

    return normalized_events


