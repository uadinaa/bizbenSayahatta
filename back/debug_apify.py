"""
Debug script for TripAdvisor Apify data fetching
Run with: python debug_apify.py
"""
import os
import sys
import django

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bizbenSayahatta.settings")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from llm.services.tripadvisor_service import (
    fetch_tours_from_tripadvisor,
    get_tours_cached,
    APIFY_API_KEY,
)
import json

print("=" * 60)
print("TRIPADVISOR APIFY DEBUG SCRIPT")
print("=" * 60)

# Check API key
print(f"\n1. APIFY API Key configured: {bool(APIFY_API_KEY)}")
if APIFY_API_KEY:
    print(f"   API Key prefix: {APIFY_API_KEY[:15]}...")

# Test with a known city
test_city = "Paris"
print(f"\n2. Testing with city: {test_city}")
print("-" * 40)

# Step 1: Test raw fetch
print("\n--- Step 1: Testing fetch_tours_from_tripadvisor() ---")
raw_tours = fetch_tours_from_tripadvisor(test_city, max_results=10)
print(f"Raw tours returned: {len(raw_tours)}")

if raw_tours:
    print("\n--- First Raw Tour Sample ---")
    first = raw_tours[0]
    print(f"Type: {type(first)}")
    if isinstance(first, dict):
        print(f"Keys: {list(first.keys())}")
        print(f"\nFirst tour data:")
        for key in ["title", "name", "rating", "reviewCount", "pricePerPerson", "image", "detailUrl", "category", "subcategory", "duration"]:
            value = first.get(key)
            if value:
                if isinstance(value, str) and len(value) > 100:
                    value = value[:100] + "..."
                print(f"  - {key}: {value}")

# Step 2: Test cached function
print("\n--- Step 2: Testing get_tours_cached() ---")
cached_tours = get_tours_cached(test_city, max_results=10, force_refresh=True)
print(f"Cached tours returned: {len(cached_tours)}")

if cached_tours:
    print("\n--- First Normalized Tour ---")
    print(json.dumps(cached_tours[0], indent=2, default=str))

# Test with another city
test_city2 = "Rome"
print(f"\n--- Step 3: Testing with city: {test_city2} ---")
cached_tours_rome = get_tours_cached(test_city2, max_results=5, force_refresh=True)
print(f"Tours for Rome: {len(cached_tours_rome)}")

if cached_tours_rome:
    for i, tour in enumerate(cached_tours_rome[:3]):
        print(f"  {i+1}. {tour['name']} - Rating: {tour['rating']} ({tour['num_reviews']} reviews)")

print("\n" + "=" * 60)
print("DEBUG COMPLETE")
print("=" * 60)
