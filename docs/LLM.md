# LLM Process Documentation

**Last Updated:** 2026-04-15

---

## Overview

The LLM layer is a multi-step pipeline that combines deterministic data retrieval with GPT-4o-mini to produce grounded, structured travel itineraries. The key design principle is **algorithmic-first, LLM-polish**: a rule-based planner builds the trip structure, then the LLM formats it into readable markdown and fills in travel advice.

**Model:** `gpt-4o-mini`  
**Temperature:** 0.7  
**Location:** `back/llm/services/`

---

## 1. Pipeline Overview

```
User message
    ↓
1. Requirements Extraction  (travel_chat.py)
    ↓
2. Cache Lookups             (hotel_cache.py, tripadvisor_service.py, places/services/cache.py)
    ↓
3. Algorithmic Trip Plan     (trip_planner.py)
    ↓
4. Context Assembly          (travel_chat.py helpers)
    ↓
5. GPT-4o-mini Call          (openai_service.py)
    ↓
6. Trip Persistence          (final_trip.py)
    ↓
Response (markdown + structured JSON)
```

---

## 2. Requirements Extraction (`travel_chat.py`)

### `collect_trip_requirements(text) → TripRequirements`

Parses free-form user messages using **regex patterns** to extract:

| Field | Extractor | Example |
|-------|-----------|---------|
| `destination` | `_extract_destination()` | "Paris" |
| `budget` | `_extract_budget()` | "$200", "200 dollars" |
| `duration_days` | `_extract_duration_days()` | "5 days", "a week", "June 1-7" |
| `num_travelers` | `_extract_travelers()` | "2 people", "for 3" |
| `traveler_type` | `_extract_traveler_type()` | solo / couple / family / group |
| `travel_style` | `_extract_travel_style()` | adventure / relaxation / culture / food / mix |
| `kids_age_band` | `_extract_kids_age_band()` | toddler / child / teens |
| `citizenship` | `_extract_citizenship()` | "US passport", "British citizen" |

**Return type:** `TripRequirements` dataclass — all fields are optional; missing fields trigger `build_missing_details_response()`.

### `extract_hotel_search_params(text) → HotelSearchParams`

Same approach for hotel-specific messages. Extracts:
- `city`, `checkin`, `checkout` (ISO dates)
- `budget` (per night)
- `adults`, `children`

### `build_missing_details_response(requirements) → str`

When required fields (destination, dates) are absent, generates a targeted follow-up question asking only for the missing info.

---

## 3. Algorithmic Trip Planner (`trip_planner.py`)

### `build_trip_plan(requirements, user) → dict`

The planner runs **before** the LLM and produces a structured itinerary JSON. The LLM only polishes this output into markdown — it does not invent new destinations or places.

**Algorithm steps:**

1. **Query places** from DB filtered by `city` (uses places matching the destination)
2. **Interest scoring** via `_score_place(place, user)`:
   - `rating × 2` (base score)
   - `+2.5` if place is in user's favorites
   - `+1.5` for each matching user interest (e.g., museums, food, nature)
3. **Budget filtering** — removes places whose price level exceeds the budget tier
4. **Family filtering** via `_is_family_safe_place(place, requirements)`:
   - Removes bars, night clubs, casinos if `traveler_type != adult`
   - Removes hiking areas if `kids_age_band == toddler`
5. **Distance clustering** via `_cluster_places(places)`:
   - Groups places that are within 1.5km of each other
   - Deduplicates items within 200m of each other
6. **Daily schedule assembly:**
   - Pace-based stop count: `slow=3`, `medium=4`, `fast=5` stops/day
   - Max 2 museums per day
   - Max 1 food stop per day
   - Reduces activities on Day 1 if arrival is afternoon

**Output (structured JSON):**
```json
{
  "city": "Paris",
  "country": "France",
  "duration_days": 5,
  "days": [
    {
      "day": 1,
      "date": "2025-06-01",
      "stops": [
        {
          "name": "Eiffel Tower",
          "category": "landmark",
          "rating": 4.7,
          "lat": 48.8584,
          "lng": 2.2945,
          "address": "Champ de Mars, Paris"
        }
      ]
    }
  ]
}
```

---

## 4. Context Assembly (`travel_chat.py`)

Before calling GPT-4o-mini, three context blocks are assembled and injected into the system prompt. Injection order matters — higher priority items appear first.

### 4.1 Grounded Places Block

```python
_build_places_context_for_city(city) → str
```

- Queries top 8 places by rating from the DB for the city
- Format: `NAME (CATEGORY) — Rating: X.X — Address: ...`
- Includes a grounding instruction to prevent hallucination:
  > "Do not invent places not listed here. If the cache is incomplete, ask the user to refresh."

### 4.2 Hotel Options Block

```python
_build_hotel_context_block(hotels, params) → str
```

- Formats up to 5 hotels from Booking.com results
- Format per hotel: name, price/night, rating, distance to center, booking URL
- Header: `"HOTEL OPTIONS FOR {city} ({checkin} → {checkout}, budget ${budget}/night):"`

### 4.3 Tour/Attraction Options Block

```python
_build_tour_context_block(tours) → str
```

- Formats tours returned from Apify TripAdvisor scraper
- Filtered to rating ≥ 8.0/10 before injection
- Format per tour: name, duration, price, rating, booking URL
- Header: `"TOURS & ATTRACTIONS FOR {city}:"`

### 4.4 Chat History

- Last 6 `ChatEntry` records from the thread (role + content)
- Prepended to the user message as conversation context

---

## 5. OpenAI Integration (`openai_service.py`)

### `ask_travel_ai(user_message, context="", history=None) → str`

**Full message construction:**

```python
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user",   "content": context},        # assembled blocks
    *[{"role": m.role, "content": m.content} for m in history[-6:]],
    {"role": "user",   "content": user_message},
]
```

**System Prompt:**
```
Ты — умный помощник по путешествиям.
Помогаешь планировать поездки, маршруты, достопримечательности,
даёшь советы по городам, транспорту и бюджету.
Отвечай кратко и по делу.

CRITICAL PLANNING RULES:
1. PROXIMITY ENFORCEMENT — all same-day stops within 1.5km
2. DEDUPLICATE OVERLAPPING LANDMARKS — merge nearby items
3. HOTEL RECOMMENDATIONS — 1-2 hotels per city matching budget
4. ESTIMATED COST PER DAY — breakdown: transport + fees + food
5. RESPECT ARRIVAL TIME ON DAY 1 — reduced activities for afternoon arrivals
6. CAFE/MEAL STOP EACH DAY — include local food specialties
7. HOTEL OPTIONS — suggest 2-3 matching budget & travel style
8. TOURS/ATTRACTIONS — prioritize 8.0+/10 ratings
```

**SDK call:**
```python
client = OpenAI(api_key=settings.OPENAI_API_KEY)
response = client.responses.create(
    model="gpt-4o-mini",
    input=messages,
    temperature=0.7,
)
```

---

### `polish_trip_plan(plan: dict) → str`

Takes the structured JSON from `build_trip_plan()` and formats it into a user-facing markdown itinerary.

**Prompt sent to GPT-4o-mini:**
```
Format this trip plan as a readable markdown itinerary.
Include: Trip overview, Day-by-day highlights, Best time to visit, Practical tips.
Source of truth is the structured plan — do NOT invent new places.

Plan: {json.dumps(plan, ensure_ascii=False)}
```

**Output:** Markdown string persisted to `FinalTrip.response_markdown`.

---

## 6. External Data Services (LLM Context Sources)

### 6.1 Booking.com Hotels (`booking_service.py`)

Used to populate the hotel context block injected into the LLM.

**API:** `https://booking-com.p.rapidapi.com/v1` via RapidAPI  
**Auth:** `X-RapidAPI-Key: {VITE_RAPIDAPI_KEY}`, `X-RapidAPI-Host: booking-com15.p.rapidapi.com`

**Flow:**
1. `GET /hotels/locations?query={city}` → resolve `dest_id`
2. `GET /hotels/search` → search with `price_min`, `price_max`, `order_by`, `adults_number`
3. `_normalize_hotel_property()` → standard dict

**Travel style → sort order mapping:**
```python
{
    "active":    "distance_from_search",
    "relaxed":   "popularity",
    "cultural":  "distance_from_search",
    "budget":    "price",
    "family":    "popularity",
}
```

**Normalized hotel fields:**
```python
{
    "id", "name", "price_per_night", "currency",
    "rating",          # 0-10 Booking.com scale
    "review_count", "address", "lat", "lng",
    "distance_to_center_km", "hotel_class",
    "booking_url",     # includes affiliate aid=356980
    "highlights",      # max 5 amenities
    "family_friendly", "cancellation_policy"
}
```

**Cache:** `hotel_cache.py` — 6h locmem, key: `hotels:{city_slug}:{checkin}:{checkout}:{budget_int}:{adults}`

---

### 6.2 TripAdvisor / Apify (`tripadvisor_service.py`)

Used to populate the tours/attractions context block.

**Actor:** `automation-lab~tripadvisor-scraper`  
**API Base:** `https://api.apify.com/v2`  
**Auth:** `Authorization: Bearer {APIFY_API_KEY}`

**Flow:**
1. `POST /acts/.../runs` with city query
2. Poll `GET /actor-runs/{run_id}` every 5s, max 60s
3. On SUCCEEDED: `GET /datasets/{dataset_id}/items`
4. `_normalize_tour()` → standard tour dict
5. Filter to rating ≥ 8.0 before injecting into context

**Normalized tour fields:**
```python
{
    "id", "name", "description",
    "price_amount", "price_currency",
    "rating",        # 0-10 TripAdvisor scale
    "num_reviews", "photo_url", "web_url",
    "duration",      # e.g. "3 hours"
    "booking_url", "category", "subcategory",
    "award", "city"
}
```

**Cache:** 24h locmem, key: `tripadvisor:tours:{city_slug}`

---

### 6.3 Google Places (grounded place context)

Places are fetched and cached **separately** (see `places/services/google_places.py`). The LLM layer reads from the DB cache, it never calls Google Places directly.

**Query:** `Place.objects.filter(city__iexact=city).order_by("-rating")[:8]`  
**Cache TTL:** 24h via `Place.cached_at` field

---

## 7. Token System

Controls API usage costs per user.

| Action | Token Cost |
|--------|-----------|
| Send chat message | 1 token |
| Generate trip plan | 2 tokens |

**Implementation:**
```python
# views.py
_consume_tokens_or_respond(user, amount)
# Returns HTTP 402 if user.tokens < amount
# Otherwise: user.tokens -= amount; user.save()
```

**Default:** New users start with 100 tokens (`User.tokens` default=100).  
**Premium:** Active subscription bypasses token check.

---

## 8. Database Models (`llm/models.py`)

### `ChatThread`
```python
user: ForeignKey(User)
kind: ChoiceField ["planner", "ai"]
title: CharField
city: CharField
start_date: DateField
end_date: DateField
plan_json: JSONField       # raw trip plan from trip_planner.py
is_archived: BooleanField
```

### `ChatEntry`
```python
thread: ForeignKey(ChatThread)
role: ChoiceField ["user", "assistant", "system"]
content: TextField
created_at: DateTimeField
```

### `FinalTrip`
```python
thread: OneToOneField(ChatThread)
city: CharField
country: CharField
itinerary: JSONField          # day-by-day stops with geocoords
route: JSONField              # ordered list of stops for map
plan_snapshot: JSONField      # raw plan at time of generation
response_markdown: TextField  # LLM-polished itinerary
```

---

## 9. API Endpoints

| Method | Endpoint | Purpose | Tokens |
|--------|----------|---------|--------|
| GET | `/api/llm/threads/` | List user's chat threads | 0 |
| POST | `/api/llm/threads/` | Create new thread | 0 |
| GET | `/api/llm/threads/{id}/messages/` | Fetch thread messages | 0 |
| POST | `/api/llm/threads/{id}/messages/` | Send message → AI response | 1 |
| POST | `/api/llm/threads/{id}/plan/` | Generate full trip plan | 2 |
| GET | `/api/chats/{id}/trip/` | Fetch saved FinalTrip | 0 |
| PATCH | `/api/llm/threads/{id}/archive/` | Toggle archive | 0 |
| DELETE | `/api/llm/threads/{id}/` | Delete thread | 0 |

---

## 10. Full Chat → Plan Flow (End-to-End)

```
User types: "Plan 5 days in Rome, $1500 total, couple, cultural trip"
    ↓
POST /api/llm/threads/{id}/messages/
    ↓
[Token check: user.tokens >= 1]
    ↓
ChatEntry.create(role="user", content=message)
    ↓
collect_trip_requirements(message)
    → destination="Rome", budget=300/day, duration=5, style="cultural", travelers=2
    ↓
If requirements incomplete → build_missing_details_response() → return early
    ↓
extract_hotel_search_params(message)
    → {city="Rome", checkin=..., checkout=..., budget=300, adults=2}
    ↓
[Hotel cache check] → miss → booking_service.search_hotels() → cache 6h
    ↓
[TripAdvisor cache check] → miss → tripadvisor_service.fetch_tripadvisor_tours("Rome") → cache 24h
    ↓
[Places cache check] → hit → top 8 by rating from DB
    ↓
build_trip_plan(requirements, user)
    → Filter, score, cluster, build 5-day itinerary JSON
    ↓
_build_places_context_for_city("Rome")      # block 1
_build_hotel_context_block(hotels, params)  # block 2
_build_tour_context_block(tours)            # block 3
[last 6 chat messages]                      # block 4
    ↓
ask_travel_ai(user_message, context=blocks, history=last_6)
    → client.responses.create(model="gpt-4o-mini", input=messages, temperature=0.7)
    ↓
polish_trip_plan(plan_json)
    → GPT-4o-mini formats as markdown with hotels, tours, cost breakdowns embedded
    ↓
user.tokens -= 1
ChatEntry.create(role="assistant", content=markdown)
sync_final_trip(thread, {itinerary, route, markdown})
    → FinalTrip.create() or update()
    ↓
Response: {response: markdown, plan: JSON, trip_id: ...}
    ↓
React: renders markdown in chat panel + stores plan for map display
```

---

## 11. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Algorithmic planner before LLM | Ensures deterministic, proximity-correct itineraries; LLM only formats |
| Grounded places only | Prevents LLM from hallucinating places; all recommendations from DB cache |
| 3-layer context injection | Places (accuracy) → Hotels (booking) → Tours (enrichment) |
| Regex extraction, not LLM | Faster, cheaper, predictable for structured travel params |
| Token system | Per-message cost control; premium users bypass |
| 24h / 6h cache TTLs | Balance between data freshness and API cost reduction |
| LocMem cache | Sufficient for single-worker dev; upgrade to Redis for multi-worker prod |
