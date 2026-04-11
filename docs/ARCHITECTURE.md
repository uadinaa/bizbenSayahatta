# bizbenSayahatta Architecture Documentation

**Last Updated:** 2026-04-10

---

## 1. Project Overview

**bizbenSayahatta** is a full-stack travel planning application that helps users discover places, plan trips, and get AI-powered travel recommendations. The app combines:

- **Place discovery** via Google Places API with caching
- **AI-powered trip planning** using OpenAI GPT-4o-mini
- **Hotel search** via Booking.com RapidAPI
- **TripAdvisor marketplace** for user-generated travel itineraries
- **Social features** including wishlists, visited places, and shared maps
- **Payment integration** via Stripe for premium features

### Tech Stack
- **Backend:** Django 5.0 + Django REST Framework
- **Frontend:** React 19 + Vite + Redux Toolkit
- **Database:** PostgreSQL (via DATABASE_URL)
- **Cache:** Django locmem cache (in-memory)
- **AI:** OpenAI GPT-4o-mini

---

## 2. Frontend Structure

### 2.1 Main Pages (`/front/src/pages/`)

| Page | Route | Description |
|------|-------|-------------|
| `Home.jsx` | `/` | Landing page with hero, features, CTA |
| `PlannerTest.jsx` | `/planner` | Main AI trip planner interface with chat |
| `Inspiration.jsx` | `/inspiration` | Place discovery with filters (budget, open now, categories) |
| `Map.jsx` | `/map` | Interactive Leaflet map of user's saved places |
| `Trips.jsx` | `/trips` | User's created/saved trips |
| `Profile.jsx` | `/profile` | User profile, preferences, subscription status |
| `Wishlist.jsx` | `/wishlist` | User's saved/favorited places |
| `Login.jsx` / `Signup.jsx` | `/login`, `/signup` | Authentication |
| `ErrorPage.jsx` | `/error` | Error handling page |
| `TripStatus.jsx` | `/trip-status` | Trip moderation/review status |
| `ManagerAdvisorReview.jsx` | `/manager/advisor` | Admin/manager review interface |
| `SharedMaps.jsx` | `/shared-maps` | View other users' shared travel maps |

### 2.2 Key Components (`/front/src/components/`)

#### Shared Components
| Component | Path | Purpose |
|-----------|------|---------|
| `TabBar.jsx` | `components/TabBar/` | Reusable pill-style tab navigation |
| `Header.jsx` | `components/` | Main navigation header |
| `Footer.jsx` | `components/` | Site footer |
| `RequireAuth.jsx` | `components/` | Route guard for protected routes |
| `AddTripModal.jsx` | `components/` | Modal for creating new trips |
| `TravelPlannerMap.jsx` | `components/` | Map component for trip planning |

#### Feature-Specific Components
| Component | Path | Purpose |
|-----------|------|---------|
| `PlaceCard.jsx` | `components/places/` | Card display for places with favorite toggle |
| `PlaceFilters.jsx` | `components/places/` | Filter controls for place lists |
| Chat components | `components/chat/` | AI chat interface elements |
| Profile components | `components/profile/` | Profile form, avatar upload |
| Trip components | `components/trips/` | Trip list, trip detail views |
| Inspiration components | `components/inspiration/` | Inspiration feed UI |
| Map components | `components/map/` | Leaflet map wrappers |

### 2.3 State Management (Redux Toolkit)

**Store:** `/front/src/store.js`
**Single Slice:** `/front/src/slices/authSlice.jsx`

#### Auth Slice State
```javascript
{
  user: null,           // User object from /api/users/profile/
  token: null,          // JWT access token
  isAuthenticated: false,
  loading: false,
  error: null
}
```

#### Auth Slice Actions
- `signUpUser` - POST `/api/users/signup/`
- `loginUser` - POST `/api/token/` + fetch profile
- `fetchProfile` - GET `/api/users/profile/`
- `updatePreferences` - PUT `/api/users/profile/`
- `uploadUserPhoto` - PATCH `/api/users/profile/` with FormData
- `logoutUser` - Clear state + localStorage

#### Token Management
- Access token stored in `localStorage` as `access`
- Refresh token stored in `localStorage` as `refresh`
- Auto-refresh via interceptor when 401 received
- Token validation includes expiry check before use

### 2.4 API Client (`/front/src/api/axios.js`)

**Base URL:** `VITE_API_BASE` env var or `http://127.0.0.1:8000/api/`

**Interceptors:**
- Request: Adds `Authorization: Bearer {token}` header
- Response: Handles 401 with token refresh, global error redirect for 5xx

**Public endpoints (no auth):**
- `users/signup/`
- `users/login/`
- `token/`
- `token/refresh/`

### 2.5 API Modules (`/front/src/api/`)

| Module | Functions |
|--------|-----------|
| `places.js` | `fetchInspirationPlaces`, `toggleMustVisit`, `fetchMapPlaces`, `createMapPlace`, `markPlaceAsVisited` |
| `chats.js` | `fetchChats`, `fetchChatMessages`, `createChatThread`, `sendChatMessage`, `generateChatPlan`, `fetchChatTrip`, `toggleChatArchive`, `deleteChatThread` |
| `comments.js` | Comment CRUD operations |
| `map.js` | User map place operations |

---

## 3. Backend Structure

### 3.1 Django Apps

```
back/
├── bizbenSayahatta/    # Project settings, URLs, middleware
├── users/              # Auth, user model, preferences
├── places/             # Place model, Google Places integration
├── llm/                # AI chat, trip planning, OpenAI integration
├── marketplace/        # TripAdvisor marketplace, trips, reviews
├── payments/           # Stripe payment integration
├── admin_api/          # Admin audit logs
└── graphs/             # (Unused/empty)
```

### 3.2 Models

#### `users/models.py`

**User** (Custom user model, `AUTH_USER_MODEL`)
```python
email: EmailField (unique)
username: CharField (blank)
avatar: ImageField (avatars/)
cover: ImageField (covers/)
role: ChoiceField [USER, TRIPADVISOR, MANAGER, ADMIN]
is_active: BooleanField
is_blocked: BooleanField
block_expires_at: DateTimeField
subscription_status: ChoiceField [INACTIVE, ACTIVE, CANCELED]
tokens: PositiveIntegerField (default=100)
referral_code: CharField (unique)
ranking_score: FloatField (default=0)
status_level: CharField (default="BRONZE")
```

**UserPreferences**
```python
user: OneToOneField(User)
budget: IntegerField
travel_style: CharField
citizenship: CharField (default="")
traveler_level: CharField (default="Explorer")
badges: JSONField (list)
open_now: BooleanField
interests: JSONField (list)
share_map: BooleanField (default=False)
share_visited_places: BooleanField (default=False)
share_badges: BooleanField (default=False)
```

#### `places/models.py`

**Place**
```python
google_place_id: CharField (unique, indexed)
name: CharField(255)
category: CharField(100)
types: JSONField (list)
rating: FloatField
user_ratings_total: IntegerField
price_level: CharField
opening_hours: JSONField
photo_url: URLField
website: URLField
neighborhood: CharField
is_must_visit: BooleanField (default=False)
address: TextField
city: CharField(100)
country: CharField(100)
lat: FloatField
lng: FloatField
status: ChoiceField [trending, popular, hidden gem]
saves_count: PositiveIntegerField (default=0)
cached_at: DateTimeField
```

**PlaceSearchCache** - Tracks cache freshness per city/category
```python
city: CharField
category: CharField
last_fetched: DateTimeField
```

**SavedPlace** - User's saved places (wishlist)
```python
user: ForeignKey(User)
place: ForeignKey(Place)
created_at: DateTimeField
unique_together: (user, place)
```

**VisitedPlace**
```python
user: ForeignKey(User)
place: ForeignKey(Place)
created_at: DateTimeField
visited_at: DateTimeField (nullable)
```

**MustVisitPlace**
```python
user: ForeignKey(User)
place: ForeignKey(Place)
created_at: DateTimeField
```

**UserMapPlace** - User's custom map markers
```python
user: ForeignKey(User)
city: CharField
country: CharField
date: CharField
lat: FloatField
lon: FloatField
```

**InterestMapping** - Maps interest keywords to place types
```python
name: CharField (unique)
mappings: JSONField
```

#### `llm/models.py`

**ChatThread**
```python
user: ForeignKey(User)
kind: ChoiceField [planner, ai]
title: CharField
city: CharField
start_date: DateField
end_date: DateField
plan_json: JSONField
is_archived: BooleanField (indexed)
```

**ChatEntry** - Chat messages
```python
thread: ForeignKey(ChatThread)
role: ChoiceField [user, assistant, system]
content: TextField
created_at: DateTimeField
```

**ChatMessage** - Legacy chat storage
```python
user: ForeignKey(User)
user_message: TextField
ai_response: TextField
created_at: DateTimeField
```

**FinalTrip** - Persisted trip result
```python
thread: OneToOneField(ChatThread)
city: CharField
country: CharField
itinerary: JSONField
route: JSONField
plan_snapshot: JSONField
response_markdown: TextField
```

#### `marketplace/models.py`

**AdvisorCategory**
```python
name: CharField (unique)
slug: SlugField (unique)
is_active: BooleanField
```

**TripAdvisorApplication**
```python
user: ForeignKey(User)
contract_accepted: BooleanField
terms_accepted: BooleanField
subscription_plan: CharField
payment_reference: CharField
cv_file: FileField
portfolio_links: JSONField
status: ChoiceField [PENDING, APPROVED, REJECTED, MORE_INFO]
reviewed_by: ForeignKey(User)
review_reason: TextField
reviewed_at: DateTimeField
```

**TripAdvisorProfile**
```python
user: OneToOneField(User)
categories: ManyToMany(AdvisorCategory)
description: TextField
social_links: JSONField
verified: BooleanField
rating: FloatField
total_reviews: PositiveIntegerField
completed_trips: PositiveIntegerField
engagement_score: FloatField
trust_score: FloatField (default=100)
ranking_score: FloatField (indexed)
status_level: CharField (default="BRONZE")
violation_count: PositiveIntegerField
```

**Trip**
```python
advisor: ForeignKey(User)
title: CharField(255)
category: ForeignKey(AdvisorCategory)
destination: CharField(120)
duration_days: PositiveIntegerField
available_dates: JSONField
booked_hotels: JSONField
restaurants: JSONField
itinerary_json: JSONField
included_services: JSONField
advisor_advantages: JSONField
price: DecimalField
social_links: JSONField
map_route: JSONField
media_urls: JSONField
customer_user: ForeignKey(User, nullable)
visibility: ChoiceField [PUBLIC, PRIVATE]
status: ChoiceField [DRAFT, PENDING, APPROVED, REJECTED]
rating: FloatField
review_count: PositiveIntegerField
rejection_reason: TextField
submitted_at: DateTimeField
approved_at: DateTimeField
approved_by: ForeignKey(User)
version: PositiveIntegerField
```

**Comment**
```python
user: ForeignKey(User)
place: ForeignKey(Place)
comment_text: TextField
is_deleted: BooleanField
```

**WishlistFolder**, **WishlistItem** - User wishlists
**UserRestriction** - User bans/restrictions
**ModerationLog** - Admin action audit trail
**SubscriptionEvent** - Stripe subscription webhooks
**ReferralReward** - Referral program tracking

#### `payments/models.py`

**Payment**
```python
id: UUIDField (primary key)
user: ForeignKey(User)
amount: DecimalField
currency: CharField (default="usd")
status: ChoiceField [pending, success, failed]
provider: CharField (default="stripe")
stripe_payment_intent_id: CharField
stripe_checkout_session_id: CharField
```

**StripeWebhookEvent** - Idempotency tracking
```python
stripe_event_id: CharField (unique)
event_type: CharField
received_at: DateTimeField
```

#### `admin_api/models.py`

**AdminAuditLog**
```python
admin: ForeignKey(User)
action: CharField
target_type: CharField
target_id: CharField
metadata: JSONField
created_at: DateTimeField
```

### 3.3 Services Layer

#### `/back/places/services/`

**google_places.py**
- `fetch_places_from_google(city, category)` - Calls Google Places Text Search API
- `save_places_to_db(places_data, city, category)` - Upserts places
- `get_places(city, category, force_refresh)` - Main entry: cache-first, then API
- `_extract_neighborhood()`, `_extract_country()`, `_extract_city()` - Address parsing

**cache.py**
- `get_cached_places(city, category)` - Returns places cached within 24 hours

**save_place.py**
- `save_place_for_user(user, place_id)` - Toggle saved place
- `set_place_wishlist_state(user, place_id, is_favorited)` - Set favorite state

#### `/back/llm/services/`

**openai_service.py**
- `ask_travel_ai(user_message, context, history)` - GPT-4o-mini chat with travel system prompt
- `polish_trip_plan(plan)` - Formats raw plan JSON into readable markdown

**booking_service.py**
- `search_hotels(city, checkin, checkout, budget, adults, children, travel_style)` - Main hotel search
- `get_hotel_locations(city)` - Resolve city to dest_id
- `get_hotel_details(hotel_id)` - Fetch hotel details
- `_normalize_hotel_property()` - Normalize Booking.com response
- `_build_booking_url()` - Construct affiliate booking URL

**hotel_cache.py**
- `get_hotels_cached()` / `cache_hotels()` - 6-hour TTL cache
- `build_hotel_cache_key()` - Key format: `hotels:{city}:{checkin}:{checkout}:{budget}:{adults}`

**trip_planner.py**
- `build_trip_plan()` - Algorithmic itinerary builder with:
  - Interest matching (museums, food, nightlife, nature, etc.)
  - Budget filtering
  - Family-friendly filtering
  - Distance clustering (groups nearby places per day)
  - Pace-based stop count (slow=3, medium=4, fast=5 per day)
  - Museum limit (max 2/day), food limit (max 1/day)

**travel_chat.py**
- `collect_trip_requirements()` - Extract destination, budget, dates, travelers, style from text
- `extract_hotel_search_params()` - Extract hotel-specific params
- `build_missing_details_response()` - Prompt for missing info
- `_build_hotel_context_block()` - Format hotels for LLM context

**geocoding.py**
- `geocode_place(place_name, city, country)` - Nominatim (OpenStreetMap) geocoding

**final_trip.py**
- `sync_final_trip(thread, payload)` - Persist generated trip to FinalTrip model

**ranking.py**, **referral.py**, **trips.py** - TripAdvisor ranking, referral rewards, trip versioning

#### `/back/marketplace/services/`

**trips.py**
- `create_trip_version()` - Snapshot trip on save
- `submit_trip_for_moderation()` - Submit for review
- `approve_trip()`, `reject_trip()` - Moderation actions

**audit.py**
- `log_action()` - Record admin actions

---

## 4. External APIs

### 4.1 Google Places API (New)

**Endpoint:** `https://places.googleapis.com/v1/places:searchText`

**Usage:** Place discovery by city + category

**Request:**
```http
POST /places:searchText
Headers:
  Content-Type: application/json
  X-Goog-Api-Key: {GOOGLE_MAPS_API_KEY}
  X-Goog-FieldMask: places.id,places.displayName,places.types,places.rating,...

Body:
  {
    "textQuery": "{category} in {city}",
    "maxResultCount": 10
  }
```

**Caching:**
- Model: `PlaceSearchCache` + `Place.cached_at`
- TTL: 24 hours
- Key: `(city, category)` pair
- Invalidated when `cached_at` > 24 hours ago

**Field Mask (cost optimization):**
Only requested fields: `id`, `displayName`, `types`, `rating`, `userRatingCount`, `formattedAddress`, `location`, `priceLevel`, `regularOpeningHours`, `photos`, `websiteUri`, `addressComponents`

---

### 4.2 Booking.com RapidAPI

**Endpoint:** `https://booking-com.p.rapidapi.com/v1`

**Usage:** Hotel search for trip planning

**Endpoints Used:**
1. `GET /hotels/locations` - Resolve city name to `dest_id`
2. `GET /hotels/search` - Search hotels with filters
3. `GET /hotels/details` - Get hotel details by ID

**Request (search):**
```http
GET /hotels/search?dest_id={id}&dest_type={type}&checkin_date={YYYY-MM-DD}&checkout_date={YYYY-MM-DD}&adults_number={n}&order_by={sort}&filter_by_currency=USD&locale=en-gb&limit=10&price_min={min}&price_max={max}

Headers:
  X-RapidAPI-Key: {RAPIDAPI_KEY}
  X-RapidAPI-Host: booking-com15.p.rapidapi.com
```

**Travel Style Mapping:**
```python
TRAVEL_STYLE_TO_ORDER = {
    "active": "distance_from_search",
    "relaxed": "popularity",
    "cultural": "distance_from_search",
    "budget": "price",
    "family": "popularity",
}
```

**Caching:**
- Backend: Django locmem cache
- TTL: 6 hours
- Key format: `hotels:{city_slug}:{checkin}:{checkout}:{budget}:{adults}`
- Only caches non-empty results (avoids caching failures)

**Affiliate URLs:**
Booking URLs include `aid=356980&label=ref-{hotel_id}` for tracking

---

### 4.3 OpenAI API

**Model:** `gpt-4o-mini`

**Usage:** AI travel assistant chat

**Endpoint:** `client.responses.create()` (Anthropic SDK format)

**System Prompt:**
```
Ты — умный помощник по путешествиям.
Помогаешь планировать поездки, маршруты, достопримечательности,
даёшь советы по городам, транспорту и бюджету.
Отвечай кратко и по делу.

When HOTEL OPTIONS are provided:
- Suggest 2-3 hotel options matching budget and travel style
- If "active/hiking", prefer hotels near nature/mountains
- If traveling with children, only suggest family-friendly hotels
- Always include booking URL
```

**Context Injection:**
- Grounded places from DB (max 8)
- Hotel options block (max 5)
- Recent chat history (last 6 messages)

**Token Cost:**
- Chat message: 1 token
- Plan generation: 2 tokens

---

### 4.4 Nominatim (OpenStreetMap)

**Endpoint:** `https://nominatim.openstreetmap.org/search`

**Usage:** Geocode place names to lat/lng for map display

**Request:**
```http
GET /search?q={place_name},{city},{country}&format=json&limit=1
Headers:
  User-Agent: bizben-sayahat/1.0
```

**Caching:** No explicit caching (lightweight, rate-limited by User-Agent)

---

### 4.5 Stripe

**Usage:** Payment Links for TripAdvisor subscription

**Flow:**
1. User creates payment via `POST /api/payments/`
2. Backend generates Stripe Payment Link URL with `client_reference_id={payment_id}`
3. User completes checkout on Stripe-hosted page
4. Webhook `checkout.session.completed` → mark payment success

**Webhook Events Handled:**
- `checkout.session.completed`
- `payment_intent.succeeded`

**Idempotency:** `StripeWebhookEvent` model tracks processed event IDs

**Environment Variables:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PAYMENT_LINK_URL` (base Payment Link URL)

---

## 5. Caching Strategy

### 5.1 Cache Backend

**Django LocMem Cache** (in-memory, per-process)
```python
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "unique-snowflake",
        "TIMEOUT": 3600,
    }
}
```

**Note:** In production with multiple workers, consider Redis for shared cache.

### 5.2 Cache TTL by Data Type

| Data Type | TTL | Strategy |
|-----------|-----|----------|
| Places (city+category) | 24 hours | `Place.cached_at` timestamp check |
| Hotels (search params) | 6 hours | Django cache with composite key |
| Chat tokens | N/A | Database counter (not cached) |

### 5.3 Places Caching (`places/services/cache.py`)

```python
def get_cached_places(city: str, category: str):
    cutoff_time = timezone.now() - timedelta(hours=24)
    return Place.objects.filter(
        city__iexact=city,
        category__iexact=category,
        cached_at__gte=cutoff_time,
    )
```

**Cache Miss Flow:**
1. Query Google Places API
2. Save to `Place` model via `update_or_create`
3. Update `cached_at` to `timezone.now()`

### 5.4 Hotels Caching (`llm/services/hotel_cache.py`)

**Key Format:**
```
hotels:{city_slug}:{checkin}:{checkout}:{budget_int}:{adults}
```

**Functions:**
- `get_hotels_cached()` - Return cached or fetch + cache
- `cache_hotels()` - Only cache non-empty results
- `is_hotel_cached()` - Boolean check

---

## 6. Data Flow: API → Django → LLM → React

### 6.1 Place Discovery Flow

```
User opens /inspiration
    ↓
React: fetchInspirationPlaces(city, category, filters)
    ↓
Django: PlacesListAPIView.get()
    ↓
places.services.google_places.get_places()
    ↓
[Cache check: 24h] → Hit: return DB places
    ↓ Miss
Google Places API: POST /places:searchText
    ↓
places.services.google_places.save_places_to_db()
    ↓ (upsert via google_place_id)
Place.objects.update_or_create(...)
    ↓
Update cached_at = timezone.now()
    ↓
Return Place queryset
    ↓
DRF Serializer → JSON
    ↓
React: PlaceCard components render
```

### 6.2 AI Trip Planning Flow

```
User: "Plan 5 days in Paris, budget $200/day"
    ↓
React: sendChatMessage(threadId, message)
    ↓
Django: ChatEntry.create() + travel_chat._generate_thread_trip_response()
    ↓
travel_chat.collect_trip_requirements()
    ↓ (extracts: destination=Paris, budget=200, duration=5, style=...)
    ↓
trip_planner.build_trip_plan()
    ↓
[Query Place DB for Paris]
    ↓
[Filter by budget, interests, family-safety]
    ↓
[Score places by rating + user favorites]
    ↓
[Cluster by distance, build day-by-day itinerary]
    ↓
openai_service.polish_trip_plan(plan_json)
    ↓
GPT-4o-mini: Format as markdown itinerary
    ↓
sync_final_trip(thread, payload) → FinalTrip.create()
    ↓
Return {response: markdown, plan: JSON, sources: [...]}
    ↓
React: Chat UI displays markdown + saves plan
```

### 6.3 Hotel Search Flow (LLM Context)

```
User: "I need hotels in Paris for June 1-5, $150/night"
    ↓
travel_chat.extract_hotel_search_params()
    ↓
HotelSearchParams: {city: "Paris", checkin: "2025-06-01", checkout: "2025-06-05", budget: 150}
    ↓
hotel_cache.get_hotels_cached()
    ↓
[Cache check: 6h] → Hit: return hotels
    ↓ Miss
booking_service.search_hotels()
    ↓
RapidAPI: GET /hotels/locations → dest_id
    ↓
RapidAPI: GET /hotels/search (with price_min/max, order_by style)
    ↓
_normalize_hotel_property() → standard format
    ↓
Cache: cache.set(key, hotels, timeout=6*3600)
    ↓
_build_hotel_context_block(hotels, params)
    ↓
Inject into LLM context as "HOTEL OPTIONS FOR Paris..."
    ↓
GPT-4o-mini includes hotels in response with booking URLs
```

---

## 7. Shared Components

### 7.1 PlaceCard (`components/places/PlaceCard.jsx`)

**Props:**
```javascript
{
  place: object,           // Place data
  variant: "inspiration" | "wishlist",
  onOpen: function,        // Click handler for detail view
  onToggleFavorite: function,
  isFavorited: boolean
}
```

**Features:**
- Lazy-loaded photo
- Heart button for wishlist toggle
- Category badge, rating, price tier display
- Location formatting via `formatLocation()` utility

### 7.2 TabBar (`components/TabBar/TabBar.jsx`)

**Props:**
```javascript
{
  tabs: [{id, label, icon?}],
  activeTab: string,
  onTabChange: function,
  className: string
}
```

**Usage:** Used across Planner, Profile, Trips pages for section navigation

### 7.3 PlaceFilters (`components/places/PlaceFilters.jsx`)

**Filters:**
- Budget slider (price level)
- Open now toggle
- Category selector
- Sort options

---

## 8. URL Routing

### 8.1 Backend API Routes (`back/bizbenSayahatta/urls.py`)

```
/admin/                      → Django admin
/api/admin/                  → Admin API
/api/users/                  → User auth, profile
/api/llm/                    → Chat threads, messages
/api/chats/                  → Chat trip endpoints
/api/places/                 → Places CRUD, inspiration, map
/api/marketplace/            → TripAdvisor marketplace
/api/payments/               → Stripe payments
/token/                      → JWT obtain
/api/token/refresh/          → JWT refresh
```

### 8.2 Frontend Routes (React Router)

Routes defined in main app routing (not shown in scanned files, inferred from pages):
- `/` → Home
- `/planner` → PlannerTest (AI chat)
- `/inspiration` → Inspiration (place discovery)
- `/map` → Map (Leaflet)
- `/trips` → Trips list
- `/wishlist` → Wishlist
- `/profile` → Profile
- `/login`, `/signup` → Auth
- `/error` → ErrorPage

---

## 9. Permissions & Roles

### 9.1 User Roles

```python
USER = "USER"
TRIPADVISOR = "TRIPADVISOR"
MANAGER = "MANAGER"
ADMIN = "ADMIN"
```

### 9.2 Permission Classes

- `IsAuthenticated` - DRF standard
- `IsActiveAndNotBlocked` - Custom: user.is_active AND NOT is_blocked
- `IsTripAdvisorRole` - marketplace/trip creation
- `IsManagerRole` - moderation
- `IsAdminRole` - admin actions

### 9.3 Throttling

```python
DEFAULT_THROTTLE_RATES = {
    'admin_sensitive': '30/hour',
}
```

---

## 10. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | OpenAI GPT-4o-mini | Yes |
| `GOOGLE_MAPS_API_KEY` | Google Places API | Yes |
| `DATABASE_URL` | PostgreSQL connection (SSL required) | Yes |
| `VITE_RAPIDAPI_HOST` | Booking.com API host | No (default: booking-com15.p.rapidapi.com) |
| `VITE_RAPIDAPI_KEY` | RapidAPI key | Yes for hotels |
| `VITE_API_BASE` | Frontend API base URL | No (default: http://127.0.0.1:8000/api/) |
| `STRIPE_SECRET_KEY` | Stripe payments | Yes for payments |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Yes for webhooks |
| `STRIPE_PAYMENT_LINK_URL` | Payment Link base URL | Yes for checkout |
| `SECRET_KEY` | Django secret | No (dev default exists) |
| `DEBUG` | Debug mode | No (default: False) |

---

## 11. Key Design Decisions

1. **Cache-first architecture** for places/hotels to minimize API costs
2. **Algorithmic trip planning** before LLM polish (deterministic + AI formatting)
3. **Grounded AI responses** - LLM only recommends cached places from DB
4. **Token system** for AI usage (1 token/chat, 2 tokens/plan)
5. **LocMem cache** - Simple for dev, needs Redis for production scale
6. **JWT with refresh** - Stateless auth with 60min access / 1day refresh
7. **Stripe Payment Links** - Minimal PCI scope, hosted checkout

---

## 12. Future Considerations

- **Redis cache** for multi-worker deployments
- **Rate limiting** on Google Places (field mask helps, but monitor quota)
- **Hotel price freshness** - 6h TTL may need adjustment for dynamic pricing
- **Nominatim rate limits** - Consider caching geocoding results
- **Webhook security** - Ensure `STRIPE_WEBHOOK_SECRET` is used for signature verification
