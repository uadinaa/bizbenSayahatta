# LLM Analysis Summary

**Analyzed:** 2026-04-10

---

## 1. Google Places Service (`back/places/services/google_places.py`)

### Structure
Single-file service with functional organization:

| Function | Purpose |
|----------|---------|
| `fetch_places_from_google()` | POST to Google Places Text Search API |
| `save_places_to_db()` | Upsert places via `update_or_create` |
| `get_places()` | Main entry: cache-first, then API fetch |
| `_build_photo_url()` | Construct photo URL from place photo name |
| `_extract_neighborhood()` | Parse neighborhood from address components |
| `_extract_country()` | Extract country from address components |
| `_extract_city()` | Extract city/locality from address components |

### Normalization
Places are normalized in `save_places_to_db()` via `update_or_create` on `google_place_id`:

```python
Place.objects.update_or_create(
    google_place_id=place["id"],
    defaults={
        "name": place["displayName"]["text"],
        "category": category,
        "types": place.get("types", []),
        "rating": place.get("rating"),
        "user_ratings_total": place.get("userRatingCount"),
        "price_level": place.get("priceLevel"),
        "opening_hours": place.get("regularOpeningHours"),
        "photo_url": _build_photo_url(photos[0]) if photos else None,
        "website": place.get("websiteUri"),
        "neighborhood": _extract_neighborhood(place),
        "address": place.get("formattedAddress", ""),
        "city": city,
        "country": _extract_country(place),
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
    },
)
```

### Caching
- **Backend:** Django database (`Place.cached_at` field)
- **TTL:** 24 hours
- **Key:** Composite query `(city__iexact, category__iexact, cached_at__gte=cutoff)`
- **Helper:** `places/services/cache.py::get_cached_places()` queries places with `cached_at >= now - 24h`

---

## 2. Booking.com Service (`back/llm/services/booking_service.py`)

### Structure
Modular service with helper functions:

| Function | Purpose |
|----------|---------|
| `search_hotels()` | Main entry: search with budget/style filters |
| `get_hotel_locations()` | Resolve city name to Booking.com `dest_id` |
| `get_hotel_details()` | Fetch single hotel details |
| `_normalize_hotel_property()` | Normalize API response to standard format |
| `_parse_distance_to_km()` | Parse "X.X km from center" strings |
| `_extract_highlights()` | Extract amenities/highlights from facilities |
| `_is_family_friendly()` | Check family-friendly flags |
| `_extract_cancellation_policy()` | Extract cancellation text |
| `_build_booking_url()` | Construct affiliate booking URL |

### Normalization
`_normalize_hotel_property()` converts Booking.com response to standard dict:

```python
{
    "id": str(hotel_id),
    "name": name,
    "price_per_night": round(price_per_night, 2),
    "currency": "USD",
    "rating": float(review_score),  # Booking.com uses 0-10 scale
    "review_count": int(review_count),
    "address": address,
    "lat": float(latitude) or None,
    "lng": float(longitude) or None,
    "distance_to_center_km": distance_km,
    "hotel_class": int(hotel_class),
    "booking_url": booking_url,
    "highlights": highlights[:5],
    "family_friendly": bool,
    "cancellation_policy": str,
}
```

### Caching
- **Backend:** Django locmem cache (`django.core.cache.backends.locmem.LocMemCache`)
- **TTL:** 6 hours (`CACHE_HOURS = 6`)
- **Key format:** `hotels:{city_slug}:{checkin}:{checkout}:{budget_int}:{adults}`
- **Builder:** `hotel_cache.py::build_hotel_cache_key()`
- **Behavior:** Only caches non-empty results (avoids caching API failures)

---

## 3. PlaceCard Component (`front/src/components/places/PlaceCard.jsx`)

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `place` | object | **Yes** | - | Place data (name, photo_url, rating, etc.) |
| `variant` | string | No | `"inspiration"` | `"inspiration"` or `"wishlist"` |
| `onOpen` | function | No | - | Click handler for detail view |
| `onToggleFavorite` | function | No | - | Heart button click handler |
| `isFavorited` | boolean | No | `place.is_must_visit` | Override favorite state |

### Behavior
- **Photo:** Lazy-loaded; shows placeholder if `photo_url` missing
- **Heart button:** Calls `onToggleFavorite`, uses `redHeart`/`emptyHeart` SVGs
- **Location:** Uses `formatLocation()` utility (wishlist shows `city, country`)
- **Category:** Formatted via `formatCategory()` utility
- **Price:** Converted via `priceTierLabel()` (e.g., `PRICE_LEVEL_MODERATE` → `$$`)

---

## 4. Inspiration Page (`front/src/pages/Inspiration.jsx`)

### Fetching
Uses `fetchInspirationPlaces()` from `api/places.js`:

```javascript
const response = await api.get(`places/inspiration/?${params.toString()}`);
// params: page, search, category, budget, open_now
```

**Backend:** `PlacesListAPIView` (DRF `ListAPIView`) with:
- `DjangoFilterBackend` for `category`, `status`
- `OrderingFilter` for `rating`, `saves_count`
- `SearchFilter` for `name`, `city`, `country`, `category`, `address`, `neighborhood`

### Rendering
1. Fetches places with filters (search, category, budget, open_now)
2. Maps results to `PlaceCard` components:
   ```jsx
   {places.map(place => (
     <PlaceCard
       key={place.id}
       place={place}
       variant="inspiration"
       onOpen={() => openPlaceDetail(place)}
       onToggleFavorite={() => toggleMustVisit(place.id)}
     />
   ))}
   ```
3. Pagination via `next`/`previous` links from API response

---

## 5. Environment Variables (`.env`)

### TripAdvisor API Key
**Confirmed present in `back/.env`:**
```
TRIPADVISER_API_KEY=UMFBHBGABWCMLSRP6XQ3
```

**Note:** Spelled `TRIPADVISER` (not `TRIPADVISOR`) in the env file.

### Other API Keys Found
| Key | Value (truncated) | Purpose |
|-----|-------------------|---------|
| `GOOGLE_MAPS_API_KEY` | `AIzaSyBdaYggGpCKKWKH2H-iQbACHlhLvVU9jV8` | Google Places |
| `OPENAI_API_KEY` | `sk-proj-sI_paXX8RF...` | GPT-4o-mini |
| `VITE_RAPIDAPI_KEY` | `06c86f9b1cms...` | Booking.com |
| `TICKETMASTER_API_KEY` | `WCmZMSr8UdyE...` | Events (unused?) |
| `OPEN_WEATHER_API_KEY` | `f80b68e194...` | Weather (unused?) |
| `serpApi` | `af4bb46561...` | Search (unused?) |
| `STRIPE_SECRET_KEY` | `sk_test_51TG4cJ...` | Payments (test mode) |

---

## Summary Table

| Component | Backend | Cache Backend | TTL | Key Format |
|-----------|---------|---------------|-----|------------|
| Google Places | `places/services/google_places.py` | DB (`Place.cached_at`) | 24h | `(city, category)` query |
| Booking.com | `llm/services/booking_service.py` | locmem | 6h | `hotels:{city}:{checkin}:{checkout}:{budget}:{adults}` |
