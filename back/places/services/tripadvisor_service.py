# """
# TripAdvisor RapidAPI Service

# Fetches tours, attractions, and experiences from TripAdvisor via RapidAPI scraper.
# Uses database caching (CachedTour model) with in-memory cache as a secondary layer.

# RapidAPI: tripadvisor-scraper
# Endpoints:
# - GET /attractions/list?query={city}
# - GET /attractions/detail?query={tripadvisor_url}
# """

# import requests
# import re
# from datetime import datetime, timedelta
# from django.conf import settings
# from django.core.cache import cache
# from django.utils import timezone
# from places.models import CachedTour, CacheMetadata


# RAPIDAPI_KEY = getattr(settings, 'RAPIDAPI_KEY', '')
# RAPIDAPI_HOST = "tripadvisor-scraper.p.rapidapi.com"

# HEADERS = {
#     "Content-Type": "application/json",
#     "x-rapidapi-host": RAPIDAPI_HOST,
#     "x-rapidapi-key": RAPIDAPI_KEY,
# }


# def fetch_tours_from_tripadvisor(city_name: str, max_results: int = 50) -> list:
#     """
#     Fetch tours/attractions from TripAdvisor via RapidAPI scraper.

#     Args:
#         city_name: Destination city name
#         max_results: Maximum number of results to return

#     Returns:
#         List of raw tour dicts from RapidAPI, or empty list on error
#     """
#     if not RAPIDAPI_KEY:
#         print("RapidAPI key not configured")
#         return []

#     try:
#         url = "https://tripadvisor-scraper.p.rapidapi.com/attractions/list"
#         params = {"query": city_name}

#         response = requests.get(
#             url,
#             headers=HEADERS,
#             params=params,
#             timeout=30
#         )

#         if response.status_code != 200:
#             print(f"RapidAPI error: {response.status_code} - {response.text}")
#             return []

#         data = response.json()

#         # Debug: log raw response structure
#         if isinstance(data, list):
#             print(f"RapidAPI returned {len(data)} attractions for {city_name}")
#             if data:
#                 print("Sample data keys:", list(data[0].keys())[:10] if isinstance(data[0], dict) else "not a dict")
#             return data[:max_results] if len(data) > max_results else data
#         elif isinstance(data, dict):
#             # Some APIs return { "data": [...] } or { "results": [...] }
#             results = data.get("data", data.get("results", []))
#             print(f"RapidAPI returned {len(results)} attractions for {city_name} (wrapped in dict)")
#             return results[:max_results] if len(results) > max_results else results

#         return []

#     except Exception as exc:
#         print(f"TripAdvisor RapidAPI service error: {exc}")
#         return []


# def _normalize_tour(tour: dict, city: str) -> dict:
#     """
#     Normalize a RapidAPI TripAdvisor tour/attraction to our standard format.

#     RapidAPI TripAdvisor scraper output structure:
#     {
#         "title": "...",
#         "rating": 4.5,
#         "review_count": 1234,
#         "price": "$50",
#         "image": "https://...",
#         "url": "https://tripadvisor.com/...",
#         "category": "Tours",
#         ...
#     }

#     Returns dict or None if invalid.
#     """
#     # Extract basic info with safe defaults
#     name = tour.get("title") or tour.get("name", "")
#     if not name:
#         return None

#     # Description: prefer actual text, never use a URL as a description
#     description = tour.get("description", "") or ""
#     if description.startswith("http"):
#         description = ""

#     # Price info - RapidAPI returns string like "$50" or "Free"
#     price_str = tour.get("price") or tour.get("pricePerPerson", "")
#     price_amount = None
#     price_currency = "USD"
#     if price_str:
#         match = re.search(r'\$?(\d+(?:\.\d{2})?)', str(price_str))
#         if match:
#             price_amount = float(match.group(1))
#         if "€" in str(price_str):
#             price_currency = "EUR"
#         elif "£" in str(price_str):
#             price_currency = "GBP"

#     # Rating info
#     rating = tour.get("rating")
#     num_reviews = tour.get("review_count") or tour.get("reviewCount", 0)

#     # Photo: first image from photos list or direct image field
#     photos = tour.get("photos") or []
#     photo_url = ""
#     if photos and isinstance(photos, list):
#         first = photos[0]
#         if isinstance(first, dict):
#             photo_url = first.get("url") or first.get("imageUrl") or ""
#         elif isinstance(first, str):
#             photo_url = first
#     if not photo_url:
#         photo_url = tour.get("image") or tour.get("imageUrl") or tour.get("photo_url", "") or ""

#     # Web URL
#     web_url = tour.get("url") or tour.get("detailUrl", "") or ""

#     # TripAdvisor-specific extras
#     duration = tour.get("duration") or tour.get("durationText") or ""
#     booking_url = tour.get("bookingUrl") or tour.get("offerUrl", "") or ""
#     category = tour.get("category") or tour.get("type", "") or ""
#     subcategory = tour.get("subcategory") or tour.get("subCategory", "") or ""
#     if isinstance(subcategory, list) and len(subcategory) > 0:
#         subcategory = subcategory[0] if isinstance(subcategory[0], str) else subcategory[0].get("name", "")

#     # Award — can be a dict or string
#     raw_award = tour.get("award") or tour.get("badge") or None
#     if isinstance(raw_award, dict):
#         award = {
#             "award_name": raw_award.get("award_name", ""),
#             "year": str(raw_award.get("year", "")),
#             "award_type": raw_award.get("award_type", ""),
#         }
#     elif raw_award:
#         award = {"award_name": str(raw_award), "year": "", "award_type": ""}
#     else:
#         award = None

#     return {
#         "id": str(tour.get("id") or tour.get("location_id") or ""),
#         "name": name,
#         "description": description,
#         "price_amount": price_amount,
#         "price_currency": price_currency,
#         "rating": float(rating) if rating else None,
#         "num_reviews": int(num_reviews) if num_reviews else 0,
#         "photo_url": photo_url,
#         "web_url": web_url,
#         "duration": duration,
#         "booking_url": booking_url,
#         "category": category,
#         "subcategory": subcategory,
#         "award": award,
#         "city": city,
#     }


# def get_tours_cached(city: str, max_results: int = 50, force_refresh: bool = False) -> list:
#     """
#     Get tours for a city with database caching.

#     Caching strategy:
#     - Primary: Database (CachedTour model) - persists across server restarts
#     - Secondary: In-memory cache for fast repeated access within session
#     - CacheMetadata tracks when data was last fetched and if it has data

#     Args:
#         city: Destination city name
#         max_results: Maximum number of tours to return
#         force_refresh: If True, skip cache and fetch from API

#     Returns:
#         List of normalized tour dicts, or empty list on error
#     """
#     city_slug = city.lower().replace(" ", "_").replace("-", "_")
#     cache_key = f"tripadvisor:tours:{city_slug}"

#     # Check in-memory cache first (unless force_refresh)
#     if not force_refresh:
#         cached_data = cache.get(cache_key)
#         if cached_data is not None:
#             if isinstance(cached_data, dict) and cached_data.get('error'):
#                 print(f"Using cached API error for {city} (retry in 24 hours)")
#                 return []
#             return cached_data

#     # Check database cache first (unless force_refresh)
#     if not force_refresh:
#         db_tours = CachedTour.objects.filter(city=city, source="tripadvisor")[:max_results]
#         if db_tours.exists():
#             # Convert database objects to dicts
#             tours_list = [
#                 {
#                     "id": tour.external_id,
#                     "name": tour.name,
#                     "description": tour.description,
#                     "price_amount": tour.price_amount,
#                     "price_currency": tour.price_currency,
#                     "rating": tour.rating,
#                     "num_reviews": tour.num_reviews,
#                     "photo_url": tour.photo_url,
#                     "web_url": tour.web_url,
#                     "duration": tour.duration,
#                     "booking_url": tour.booking_url,
#                     "category": tour.category,
#                     "subcategory": tour.subcategory,
#                     "award": tour.award,
#                     "city": tour.city,
#                 }
#                 for tour in db_tours
#             ]
#             # Also update in-memory cache
#             cache.set(cache_key, tours_list, timeout=30 * 60)  # 30 min in-memory
#             print(f"Loaded {len(tours_list)} tours for {city} from database cache")
#             return tours_list

#         # Check metadata to see if we already tried fetching and found nothing
#         try:
#             metadata = CacheMetadata.objects.get(city=city_slug, source="tripadvisor")
#             if not metadata.has_data:
#                 # Check if 24 hours have passed since last fetch
#                 hours_since_fetch = (timezone.now() - metadata.last_fetched).total_seconds() / 3600
#                 if hours_since_fetch < 24:
#                     print(f"Using cached metadata: no tours for {city} (retry in {24 - hours_since_fetch:.1f} hours)")
#                     return []
#         except CacheMetadata.DoesNotExist:
#             pass  # First time fetching this city, continue to API

#     # Fetch from RapidAPI TripAdvisor scraper
#     raw_tours = fetch_tours_from_tripadvisor(city, max_results=max_results)

#     # Handle API error response
#     if not raw_tours:
#         # Update cache metadata to track failed fetch
#         metadata, _ = CacheMetadata.objects.get_or_create(
#             city=city_slug, source="tripadvisor", defaults={"has_data": False}
#         )
#         metadata.has_data = False
#         metadata.save()

#         # Cache empty result in-memory for 24 hours
#         cache.set(cache_key, [], timeout=24 * 60 * 60)
#         print(f"No tours found for {city} - cached in database (no data) and memory for 24 hours")
#         return []

#     # Normalize tours
#     normalized_tours = []
#     for tour in raw_tours:
#         normalized = _normalize_tour(tour, city)
#         if normalized:
#             normalized_tours.append(normalized)

#     # Store in database
#     if normalized_tours:
#         # Clear existing cached tours for this city
#         CachedTour.objects.filter(city=city, source="tripadvisor").delete()

#         # Bulk create new tours
#         tours_to_create = []
#         for tour in normalized_tours:
#             tours_to_create.append(CachedTour(
#                 external_id=tour["id"] or f"{city_slug}_{tour['name'][:50]}",
#                 source="tripadvisor",
#                 city=city,
#                 name=tour["name"],
#                 description=tour["description"],
#                 category=tour["category"],
#                 subcategory=tour["subcategory"],
#                 rating=tour["rating"],
#                 num_reviews=tour["num_reviews"],
#                 price_amount=tour["price_amount"],
#                 price_currency=tour["price_currency"],
#                 photo_url=tour["photo_url"],
#                 web_url=tour["web_url"],
#                 booking_url=tour["booking_url"],
#                 duration=tour["duration"],
#                 award=tour["award"],
#             ))

#         if tours_to_create:
#             CachedTour.objects.bulk_create(tours_to_create)

#         # Update metadata
#         metadata, _ = CacheMetadata.objects.get_or_create(
#             city=city_slug, source="tripadvisor", defaults={"has_data": True}
#         )
#         metadata.has_data = True
#         metadata.save()

#         # Update in-memory cache
#         cache.set(cache_key, normalized_tours, timeout=24 * 60 * 60)
#         print(f"Cached {len(normalized_tours)} tours for {city} in database and memory (24 hours)")
#     else:
#         # Normalize returned nothing - update metadata
#         metadata, _ = CacheMetadata.objects.get_or_create(
#             city=city_slug, source="tripadvisor", defaults={"has_data": False}
#         )
#         metadata.has_data = False
#         metadata.save()

#         cache.set(cache_key, [], timeout=24 * 60 * 60)
#         print(f"No valid tours after normalization for {city} - cached in database and memory (24 hours)")

#     return normalized_tours


# def clear_tour_cache(city: str = None):
#     """
#     Clear tour cache for a specific city or all cities.
#     Clears both database and in-memory cache.

#     Args:
#         city: If provided, clears only that city's cache.
#               If None, clears all TripAdvisor tour caches.
#     """
#     if city:
#         city_slug = city.lower().replace(" ", "_").replace("-", "_")
#         cache_key = f"tripadvisor:tours:{city_slug}"
#         # Clear in-memory cache
#         cache.delete(cache_key)
#         # Clear database cache
#         CachedTour.objects.filter(city=city, source="tripadvisor").delete()
#         # Clear metadata
#         CacheMetadata.objects.filter(city=city_slug, source="tripadvisor").delete()
#     else:
#         # Clear all in-memory cache
#         cache.delete_pattern("tripadvisor:tours:*")
#         # Clear all database cache
#         CachedTour.objects.filter(source="tripadvisor").delete()
#         CacheMetadata.objects.filter(source="tripadvisor").delete()


# def is_tour_cached(city: str) -> bool:
#     """
#     Check if tours are already cached for the given city.
#     Checks both database and in-memory cache.
#     Returns True if cached, False otherwise.
#     """
#     city_slug = city.lower().replace(" ", "_").replace("-", "_")
#     cache_key = f"tripadvisor:tours:{city_slug}"

#     # Check in-memory cache first
#     if cache.get(cache_key) is not None:
#         return True

#     # Check database cache
#     return CachedTour.objects.filter(city=city, source="tripadvisor").exists()


# Stub function for compatibility - TripAdvisor API is currently disabled
def get_tours_cached(city: str, max_results: int = 10):
    """
    Stub function - returns empty list.
    TripAdvisor API integration is currently disabled.
    """
    print(f"[tripadvisor_service] get_tours_cached called for {city}, returning empty list (API disabled)")
    return []
