"""
Booking.com RapidAPI Service

Handles all communication with Booking.com via RapidAPI.
Provides hotel search with filters based on budget, dates, and location context.
"""

import requests
from django.conf import settings


# Note: Uses VITE_ prefix to match .env file naming
RAPIDAPI_HOST = getattr(settings, 'VITE_RAPIDAPI_HOST', 'booking-com15.p.rapidapi.com')
RAPIDAPI_KEY = getattr(settings, 'VITE_RAPIDAPI_KEY', '')

BASE_URL = "https://booking-com.p.rapidapi.com/v1"

HEADERS = {
    "X-RapidAPI-Key": RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_HOST,
}

# Travel style to Booking.com sort/order mapping
TRAVEL_STYLE_TO_ORDER = {
    "active": "distance_from_search",  # Prefer proximity to nature/activities
    "relaxed": "popularity",  # Popular, well-rated properties
    "cultural": "distance_from_search",  # City-center properties
    "budget": "price",  # Sort by price ascending
    "family": "popularity",  # Family-friendly, well-rated
    "default": "popularity",
}


def search_hotels(
    city_name: str,
    checkin: str,
    checkout: str,
    budget_per_night: float,
    adults: int = 1,
    children: int = 0,
    travel_style: str = None,
) -> list:
    """
    Search hotels for a city with budget and travel style filters.
    Returns a list of hotel dicts ready for LLM context injection.

    Args:
        city_name: Destination city name
        checkin: Check-in date (YYYY-MM-DD)
        checkout: Checkout date (YYYY-MM-DD)
        budget_per_night: Budget per night in USD
        adults: Number of adults (default 1)
        children: Number of children (default 0)
        travel_style: One of 'active', 'relaxed', 'cultural', 'budget', 'family'

    Returns:
        List of hotel dicts with normalized format, or empty list on error
    """
    try:
        # First resolve city name to dest_id
        locations = get_hotel_locations(city_name)
        if not locations:
            return []

        dest_id = locations[0].get("dest_id")
        dest_type = locations[0].get("dest_type", "city")

        # Calculate price range (40-90% of budget per night)
        price_min = int(budget_per_night * 0.4)
        price_max = int(budget_per_night * 0.9)

        # Build search params
        params = {
            "dest_id": dest_id,
            "dest_type": dest_type,
            "checkin_date": checkin,
            "checkout_date": checkout,
            "adults_number": adults,
            "rooms_number": 1,
            "order_by": TRAVEL_STYLE_TO_ORDER.get(travel_style, "popularity"),
            "filter_by_currency": "USD",
            "locale": "en-gb",
            "limit": 10,
        }

        # Add children if present
        if children > 0:
            params["children_number"] = children
            # Default children ages (can be extended to accept specific ages)
            params["children_ages"] = ",".join(["5"] * children)

        # Add price filter if budget is provided
        if budget_per_night:
            params["price_min"] = price_min
            params["price_max"] = price_max

        # Make API request
        url = f"{BASE_URL}/hotels/search"
        response = requests.get(url, headers=HEADERS, params=params, timeout=15)

        if response.status_code != 200:
            print(f"Booking.com API error: {response.status_code} - {response.text}")
            return []

        data = response.json()
        properties = data.get("result", [])

        # Normalize hotel data
        hotels = []
        for prop in properties:
            hotel = _normalize_hotel_property(prop, budget_per_night, travel_style)
            if hotel:
                hotels.append(hotel)

        return hotels[:5]  # Return max 5 hotels for LLM context

    except Exception as exc:
        print(f"Booking.com service error: {exc}")
        return []


def get_hotel_locations(city_name: str) -> list:
    """
    Resolve city name to Booking.com destination ID.
    Returns list of location dicts with dest_id and dest_type.
    """
    try:
        url = f"{BASE_URL}/hotels/locations"
        params = {
            "name": city_name,
            "locale": "en-gb",
        }
        response = requests.get(url, headers=HEADERS, params=params, timeout=10)

        if response.status_code != 200:
            print(f"Booking.com locations API error: {response.status_code}")
            return []

        data = response.json()
        return data[:3] if isinstance(data, list) else []

    except Exception as exc:
        print(f"Booking.com locations error: {exc}")
        return []


def get_hotel_details(hotel_id: str) -> dict:
    """
    Fetch detailed info for a single hotel by ID.
    Returns hotel details dict or empty dict on error.
    """
    try:
        url = f"{BASE_URL}/hotels/details"
        params = {
            "hotel_id": hotel_id,
            "locale": "en-gb",
        }
        response = requests.get(url, headers=HEADERS, params=params, timeout=10)

        if response.status_code != 200:
            print(f"Booking.com details API error: {response.status_code}")
            return {}

        data = response.json()
        return _normalize_hotel_property(data, None, None) or {}

    except Exception as exc:
        print(f"Booking.com details error: {exc}")
        return {}


def _normalize_hotel_property(prop: dict, budget_per_night: float = None, travel_style: str = None) -> dict:
    """
    Normalize a Booking.com property to our standard hotel format.
    Returns dict or None if invalid.
    """
    # Extract basic info
    hotel_id = prop.get("hotel_id") or prop.get("id")
    if not hotel_id:
        return None

    name = prop.get("hotel_name") or prop.get("name", "Unknown Hotel")

    # Price info
    price_data = prop.get("price_breakdown", {})
    gross_price = prop.get("gross_price") or price_data.get("gross_price") or prop.get("min_total_price")
    price_per_night = float(gross_price) if gross_price else 0.0

    # Rating (Booking.com uses 0-10 scale)
    review_score = prop.get("review_score") or prop.get("rating") or 0.0
    review_count = prop.get("review_count") or prop.get("review_nr") or 0

    # Location
    location = prop.get("location", {})
    address = prop.get("address") or location.get("address") or ""
    latitude = location.get("latitude") or prop.get("latitude")
    longitude = location.get("longitude") or prop.get("longitude")

    # Distance to center
    distance_text = prop.get("distance_to_cc") or prop.get("distance", "")
    distance_km = _parse_distance_to_km(distance_text)

    # Hotel class (stars)
    hotel_class = prop.get("class") or prop.get("hotel_class") or 0

    # Highlights/amenities
    highlights = _extract_highlights(prop)

    # Family friendly check
    family_friendly = _is_family_friendly(prop, travel_style)

    # Cancellation policy
    cancellation = _extract_cancellation_policy(prop)

    # Booking URL construction
    booking_url = _build_booking_url(hotel_id, name)

    return {
        "id": str(hotel_id),
        "name": name,
        "price_per_night": round(price_per_night, 2),
        "currency": "USD",
        "rating": float(review_score),
        "review_count": int(review_count),
        "address": address,
        "lat": float(latitude) if latitude else None,
        "lng": float(longitude) if longitude else None,
        "distance_to_center_km": distance_km,
        "hotel_class": int(hotel_class),
        "booking_url": booking_url,
        "highlights": highlights,
        "family_friendly": family_friendly,
        "cancellation_policy": cancellation,
    }


def _parse_distance_to_km(distance_text: str) -> float:
    """Parse distance string like '1.2 km from center' to float km."""
    if not distance_text:
        return 0.0
    try:
        # Extract numeric part
        import re
        match = re.search(r"([\d.]+)\s*km", str(distance_text))
        if match:
            return float(match.group(1))
    except:
        pass
    return 0.0


def _extract_highlights(prop: dict) -> list:
    """Extract key highlights/amenities from property."""
    highlights = []

    # Check for common amenities
    amenities = prop.get("facilities", []) or prop.get("amenities", [])
    highlight_keywords = {
        "Free WiFi": ["wifi", "internet"],
        "Pool": ["pool", "swimming"],
        "Spa": ["spa", "wellness"],
        "Fitness Center": ["fitness", "gym"],
        "Restaurant": ["restaurant"],
        "Bar": ["bar"],
        "Room Service": ["room service"],
        "Airport Shuttle": ["airport", "shuttle"],
        "Parking": ["parking"],
        "Pet Friendly": ["pet", "dog", "cat"],
        "Air Conditioning": ["air conditioning", "aircon"],
        "Sea View": ["sea view", "ocean view"],
        "City View": ["city view"],
    }

    amenity_texts = []
    for amenity in amenities:
        if isinstance(amenity, dict):
            amenity_texts.append(str(amenity.get("name", "")).lower())
        else:
            amenity_texts.append(str(amenity).lower())

    amenity_text = " ".join(amenity_texts)

    for highlight, keywords in highlight_keywords.items():
        if any(kw in amenity_text for kw in keywords):
            highlights.append(highlight)

    # Add review score description if high
    review_score = prop.get("review_score") or 0
    if review_score >= 9.0:
        highlights.append("Exceptional rating")
    elif review_score >= 8.0:
        highlights.append("Excellent rating")
    elif review_score >= 7.0:
        highlights.append("Very good rating")

    return highlights[:5]  # Max 5 highlights


def _is_family_friendly(prop: dict, travel_style: str = None) -> bool:
    """Check if property is family-friendly."""
    if travel_style == "family":
        return True

    # Check for family rooms or facilities
    facilities = prop.get("facilities", []) or prop.get("amenities", [])
    facility_texts = []
    for f in facilities:
        if isinstance(f, dict):
            facility_texts.append(str(f.get("name", "")).lower())
        else:
            facility_texts.append(str(f).lower())

    facility_text = " ".join(facility_texts)

    family_keywords = ["family", "children", "kids", "babysitting", "playground"]
    return any(kw in facility_text for kw in family_keywords)


def _extract_cancellation_policy(prop: dict) -> str:
    """Extract cancellation policy from property."""
    # Check for free cancellation flag
    if prop.get("is_free_cancellable") or prop.get("free_cancellation"):
        return "Free cancellation"

    # Check cancellation text
    cancellation_text = prop.get("cancellation_policy") or prop.get("cancellation_text", "")
    if cancellation_text:
        # Return first line or truncated version
        return str(cancellation_text)[:100]

    return "Contact property for details"


def _build_booking_url(hotel_id: str, hotel_name: str, checkin: str = None, checkout: str = None) -> str:
    """
    Build Booking.com deep-link URL for the hotel.

    Uses a search-based URL that reliably finds the hotel by name + city,
    with optional check-in/check-out dates for real-time availability.

    Args:
        hotel_id: Hotel ID from Booking.com API
        hotel_name: Hotel name
        checkin: Optional check-in date (YYYY-MM-DD)
        checkout: Optional checkout date (YYYY-MM-DD)

    Returns:
        Booking.com affiliate URL with pre-filled search params
    """
    from urllib.parse import quote

    # Base search URL - searches for hotel by name
    # This is more reliable than constructing hotel-specific URLs
    params = {
        "ss": hotel_name,  # Search string (hotel name)
        "aid": "356980",  # Affiliate ID
        "label": f"ref-{hotel_id}",  # Tracking label
        "sb_price_type": "total",  # Show total price
        "srpopsrc": "affiliate",  # Traffic source
    }

    # Add dates if provided for real-time availability
    if checkin:
        params["checkin"] = checkin
    if checkout:
        params["checkout"] = checkout

    # Build query string
    query_string = "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
    return f"https://www.booking.com/searchresults.html?{query_string}"
