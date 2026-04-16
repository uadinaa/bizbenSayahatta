# """
# TripAdvisor Apify API Service

# Fetches tours, attractions, and experiences from TripAdvisor via Apify scraper.
# Uses database caching (CachedTour model) with in-memory cache as a secondary layer.

# Apify Actor: apify/actor-tripadvisor-scraper
# Input format:
# {
#     "currency": "USD",
#     "includeAiReviewsSummary": false,
#     "includeAttractions": true,
#     "includeHotels": true,
#     "includeNearbyResults": false,
#     "includePriceOffers": false,
#     "includeRestaurants": true,
#     "includeTags": false,
#     "language": "en",
#     "maxItemsPerQuery": 1000,
#     "maxPhotosPerPlace": 1,
#     "query": "Paris, Lyon, Milan, Rome"
# }
# """

# import requests
# import time
# import re
# from datetime import datetime, timedelta
# from django.conf import settings
# from django.core.cache import cache
# from django.utils import timezone
# from places.models import CachedTour, CacheMetadata


# APIFY_API_KEY = getattr(settings, "APIFY_API_KEY", "")
# APIFY_BASE_URL = "https://api.apify.com/v2"

# HEADERS = {
#     "Content-Type": "application/json",
# }


# def fetch_tours_from_tripadvisor(city_name: str, max_results: int = 50) -> list:
#     """
#     Fetch tours/attractions from TripAdvisor via Apify scraper.

#     Args:
#         city_name: Destination city name
#         max_results: Maximum number of results to return

#     Returns:
#         List of raw tour dicts from Apify dataset, or empty list on error
#     """
#     if not APIFY_API_KEY:
#         print("Apify API key not configured")
#         return []

#     try:
#         # Step 1: Start the Apify Actor run
#         # Using automation-lab/tripadvisor-scraper (most cost-effective)
#         # Docs: https://apify.com/automation-lab/tripadvisor-scraper
#         run_url = f"{APIFY_BASE_URL}/acts/automation-lab~tripadvisor-scraper/runs"
#         params = {
#             "token": APIFY_API_KEY,
#         }

#         # Build the input for Apify
#         input_data = {
#             "currency": "USD",
#             "includeAiReviewsSummary": False,
#             "includeAttractions": True,
#             "includeHotels": False,  # We only want tours/attractions
#             "includeNearbyResults": False,
#             "includePriceOffers": False,
#             "includeRestaurants": False,
#             "includeTags": False,
#             "language": "en",
#             "maxItemsPerQuery": min(max_results, 1000),
#             "maxPhotosPerPlace": 1,
#             "query": city_name,
#         }

#         response = requests.post(
#             run_url,
#             headers=HEADERS,
#             params=params,
#             json=input_data,
#             timeout=30
#         )

#         if response.status_code not in [200, 201]:
#             print(f"Apify run start error: {response.status_code} - {response.text}")
#             # Check for 502 Bad Gateway - API is unreachable
#             if response.status_code == 502:
#                 print("⚠️ TripAdvisor API is unreachable (502). Caching error for 30 min.")
#             return []

#         run_data = response.json()
#         run_id = run_data.get("data", {}).get("id")

#         if not run_id:
#             print("Could not get run ID from Apify")
#             return []

#         # Step 2: Wait for the run to complete and get results
#         max_wait_seconds = 60
#         waited = 0
#         while waited < max_wait_seconds:
#             time.sleep(2)
#             waited += 2

#             status_url = f"{APIFY_BASE_URL}/actor-runs/{run_id}"
#             status_response = requests.get(status_url, params=params, timeout=10)

#             if status_response.status_code != 200:
#                 print(f"Apify status check error: {status_response.status_code}")
#                 return []

#             status_data = status_response.json()
#             run_status = status_data.get("data", {}).get("status")

#             if run_status == "SUCCEEDED":
#                 break
#             elif run_status in ["FAILED", "ABORTED"]:
#                 print(f"Apify run failed with status: {run_status}")
#                 return []

#         # Step 3: Fetch the dataset items
#         dataset_id = status_data.get("data", {}).get("defaultDatasetId")
#         if not dataset_id:
#             print("No dataset ID from Apify run")
#             return []

#         items_url = f"{APIFY_BASE_URL}/datasets/{dataset_id}/items"
#         items_params = {
#             "token": APIFY_API_KEY,
#             "limit": max_results,
#         }

#         items_response = requests.get(items_url, params=items_params, timeout=30)

#         if items_response.status_code != 200:
#             print(f"Apify dataset fetch error: {items_response.status_code} - {items_response.text}")
#             return []

#         data = items_response.json()

#         # Apify returns a list of items directly
#         if isinstance(data, list):
#             return data
#         elif isinstance(data, dict):
#             return data.get("items", data.get("data", []))

#         return []

#     except requests.exceptions.RequestException as e:
#         # Network errors, timeouts, etc.
#         print(f"TripAdvisor Apify network error: {e}")
#         return []
#     except Exception as exc:
#         print(f"TripAdvisor Apify service error: {exc}")
#         return []


# def _normalize_tour(tour: dict, city: str) -> dict:
#     """
#     Normalize an Apify TripAdvisor tour/attraction to our standard format.

#     Apify TripAdvisor scraper output structure:
#     {
#         "title": "...",
#         "rating": 4.5,
#         "reviewCount": 1234,
#         "pricePerPerson": "$50",
#         "image": "https://...",
#         "detailUrl": "https://tripadvisor.com/...",
#         "category": "Tours",
#         "subcategory": "Cultural Tours",
#         "duration": "2 hours",
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

#     # Price info - Apify returns string like "$50" or "Free"
#     price_str = tour.get("pricePerPerson") or tour.get("price", "")
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
#     num_reviews = tour.get("reviewCount") or tour.get("numReviews", 0)

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

#     # Web URL (TripAdvisor page)
#     web_url = tour.get("detailUrl") or tour.get("url", "") or ""

#     # TripAdvisor-specific extras
#     duration = tour.get("duration") or tour.get("durationText") or ""
#     booking_url = tour.get("bookingUrl") or tour.get("offerUrl", "") or ""
#     category = tour.get("category") or tour.get("type", "") or ""
#     subcategory = tour.get("subcategory") or tour.get("subCategory", "") or ""
#     if isinstance(subcategory, list) and len(subcategory) > 0:
#         subcategory = subcategory[0] if isinstance(subcategory[0], str) else subcategory[0].get("name", "")

#     # Award — Apify returns either a dict or a string
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

#     # Fetch from Apify TripAdvisor scraper
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
    print(f"[llm/tripadvisor_service] get_tours_cached called for {city}, returning empty list (API disabled)")
    return []
