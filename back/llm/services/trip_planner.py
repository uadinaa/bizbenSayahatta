from dataclasses import dataclass
from typing import Iterable, List, Optional
import math

from places.models import Place, InterestMapping
from users.models import UserPreferences


PACE_TO_STOPS = {
    "slow": 3,
    "medium": 4,
    "fast": 5,
}

MAX_MUSEUMS_PER_DAY = 2
MAX_FOOD_STOPS_PER_DAY = 1
FAR_DISTANCE_KM = 8.0
NEARBY_DISTANCE_KM = 3.5

DEFAULT_INTEREST_TYPE_MAP = {
    "cute museums": ["museum", "art_gallery"],
    "culture": ["museum", "historical", "temple"],
    "food": ["restaurant", "cafe"],
    "coffee": ["cafe"],
    "cafes": ["cafe"],
    "nightlife": ["bar", "night_club"],
    "nature": ["park", "natural_feature"],
    "shopping": ["shopping_mall", "clothing_store", "market"],
    "history": ["museum", "historical", "monument", "tourist_attraction"],
    "art": ["art_gallery", "museum"],
    "views": ["tourist_attraction", "viewpoint"],
    "family": ["zoo", "aquarium", "park", "amusement_park"],
}


@dataclass
class ScoredPlace:
    place: Place
    score: float


def _normalize_interests(interests: Optional[Iterable[str]]) -> List[str]:
    if not interests:
        return []
    return [value.strip().lower() for value in interests if value.strip()]


def _load_interest_mapping(provider: str) -> dict:
    mapping = {}
    for row in InterestMapping.objects.all():
        if not isinstance(row.mappings, dict):
            continue
        provider_types = row.mappings.get(provider)
        if provider_types:
            mapping[row.name.lower()] = provider_types
    if not mapping:
        mapping = DEFAULT_INTEREST_TYPE_MAP
    return mapping


def _expand_interest_types(interests: List[str], provider: str = "google") -> List[str]:
    interest_map = _load_interest_mapping(provider)
    types = set()
    for interest in interests:
        mapped = interest_map.get(interest)
        if mapped:
            types.update(mapped)
        else:
            types.add(interest)
    return list(types)


def _place_matches_interest(place: Place, interests: List[str]) -> bool:
    if not interests:
        return False
    category = (place.category or "").lower()
    types = [value.lower() for value in (place.types or [])]
    expanded = _expand_interest_types(interests)
    for interest in expanded:
        if interest in category:
            return True
        for place_type in types:
            if interest in place_type:
                return True
    return False


def _score_place(place: Place, interests: List[str]) -> float:
    score = 0.0
    if place.rating:
        score += place.rating * 2
    if place.user_ratings_total:
        score += min(place.user_ratings_total, 5000) / 1000
    if _place_matches_interest(place, interests):
        score += 1.5
    if place.is_must_visit:
        score += 2.5
    return score


def _place_type_set(place: Place) -> set:
    types = set(value.lower() for value in (place.types or []))
    category = (place.category or "").lower()
    if category:
        types.add(category)
    return types


def _is_museum_place(place: Place) -> bool:
    types = _place_type_set(place)
    museum_keywords = {
        "museum",
        "art_gallery",
        "historical",
        "temple",
        "monument",
    }
    return any(keyword in types for keyword in museum_keywords)


def _is_food_place(place: Place) -> bool:
    types = _place_type_set(place)
    food_keywords = {
        "restaurant",
        "cafe",
        "bakery",
        "meal_takeaway",
        "bar",
    }
    return any(keyword in types for keyword in food_keywords)


def _compute_centroid(places: List[Place]) -> Optional[tuple]:
    if not places:
        return None
    lat_sum = 0.0
    lng_sum = 0.0
    count = 0
    for place in places:
        if place.lat is None or place.lng is None:
            continue
        lat_sum += place.lat
        lng_sum += place.lng
        count += 1
    if count == 0:
        return None
    return (lat_sum / count, lng_sum / count)


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def _is_far_place(place: Place, centroid: Optional[tuple]) -> bool:
    if centroid is None or place.lat is None or place.lng is None:
        return False
    distance = _distance_km(place.lat, place.lng, centroid[0], centroid[1])
    return distance >= FAR_DISTANCE_KM


def _distance_between_places_km(source: Place, target: Place) -> float:
    if (
        source.lat is None
        or source.lng is None
        or target.lat is None
        or target.lng is None
    ):
        return float("inf")
    return _distance_km(source.lat, source.lng, target.lat, target.lng)


def _price_level_to_number(price_level: Optional[str]) -> Optional[int]:
    if price_level is None:
        return None
    if isinstance(price_level, int):
        return price_level

    mapping = {
        "PRICE_LEVEL_FREE": 0,
        "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2,
        "PRICE_LEVEL_EXPENSIVE": 3,
        "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }
    return mapping.get(str(price_level).upper())


def _is_open_now(place: Place) -> Optional[bool]:
    if not place.opening_hours:
        return None
    if isinstance(place.opening_hours, dict):
        return place.opening_hours.get("openNow")
    return None


def _apply_preferences(
    user,
    *,
    budget: Optional[int],
    interests: List[str],
    travel_style: Optional[str],
    use_preferences: bool,
):
    if not use_preferences:
        return budget, interests, travel_style

    try:
        preferences = user.preferences
    except UserPreferences.DoesNotExist:
        return budget, interests, travel_style

    merged_budget = budget if budget is not None else preferences.budget
    merged_interests = interests or _normalize_interests(preferences.interests)
    merged_travel_style = travel_style or preferences.travel_style

    return merged_budget, merged_interests, merged_travel_style


def _build_day_stops(
    *,
    candidates: List[ScoredPlace],
    used_ids: set,
    stops_per_day: int,
    centroid: Optional[tuple],
) -> List[ScoredPlace]:
    day_stops: List[ScoredPlace] = []
    museum_count = 0
    food_count = 0
    day_capacity = stops_per_day
    day_has_far = False

    # Pick a high-score anchor first, then pull nearby places for a walkable day.
    anchor_item: Optional[ScoredPlace] = None
    for item in candidates:
        if item.place.id in used_ids:
            continue
        anchor_item = item
        break

    if anchor_item is None:
        return day_stops

    anchor_place = anchor_item.place
    day_stops.append(anchor_item)
    used_ids.add(anchor_place.id)
    museum_count = 1 if _is_museum_place(anchor_place) else 0
    food_count = 1 if _is_food_place(anchor_place) else 0
    if _is_far_place(anchor_place, centroid):
        day_has_far = True
        day_capacity = min(day_capacity, 2)

    available_items = [
        item for item in candidates if item.place.id not in used_ids
    ]
    available_items.sort(
        key=lambda item: (
            _distance_between_places_km(anchor_place, item.place),
            -item.score,
        )
    )

    # First pass: keep walkable cluster around anchor.
    for item in available_items:
        place = item.place
        distance_from_anchor = _distance_between_places_km(anchor_place, place)
        if distance_from_anchor > NEARBY_DISTANCE_KM:
            continue

        is_food = _is_food_place(place)
        is_museum = _is_museum_place(place)

        if is_food and food_count >= MAX_FOOD_STOPS_PER_DAY:
            continue
        if is_museum and museum_count >= MAX_MUSEUMS_PER_DAY:
            continue

        day_stops.append(item)
        used_ids.add(place.id)

        if is_food:
            food_count += 1
        if is_museum:
            museum_count += 1

        if len(day_stops) >= day_capacity:
            break

    # Second pass: fill remaining slots by nearest distance if needed.
    if len(day_stops) < day_capacity:
        for item in available_items:
            place = item.place
            if place.id in used_ids:
                continue
            is_food = _is_food_place(place)
            is_museum = _is_museum_place(place)

            if is_food and food_count >= MAX_FOOD_STOPS_PER_DAY:
                continue
            if is_museum and museum_count >= MAX_MUSEUMS_PER_DAY:
                continue

            day_stops.append(item)
            used_ids.add(place.id)

            if is_food:
                food_count += 1
            if is_museum:
                museum_count += 1
            if len(day_stops) >= day_capacity:
                break

    if day_has_far and food_count == 0 and len(day_stops) < day_capacity:
        for item in candidates:
            if item.place.id in used_ids:
                continue
            if _is_food_place(item.place):
                day_stops.append(item)
                used_ids.add(item.place.id)
                break

    # Museum stops first (morning preference)
    day_stops.sort(key=lambda item: 0 if _is_museum_place(item.place) else 1)

    return day_stops


def build_trip_plan(
    *,
    user,
    city: str,
    days: int,
    budget: Optional[int] = None,
    interests: Optional[Iterable[str]] = None,
    pace: Optional[str] = None,
    travel_style: Optional[str] = None,
    use_preferences: bool = True,
):
    normalized_interests = _normalize_interests(interests)
    budget, normalized_interests, travel_style = _apply_preferences(
        user,
        budget=budget,
        interests=normalized_interests,
        travel_style=travel_style,
        use_preferences=use_preferences,
    )

    pace_value = pace or ("slow" if travel_style in {"relax", "slow"} else "medium")
    stops_per_day = PACE_TO_STOPS.get(pace_value, PACE_TO_STOPS["medium"])

    base_queryset = Place.objects.filter(city__iexact=city)
    places = list(base_queryset)

    if not places:
        raise ValueError("no_places_for_city")

    filtered_places = []
    for place in places:
        open_now = _is_open_now(place)
        if open_now is False:
            continue

        if budget is not None:
            place_price = _price_level_to_number(place.price_level)
            if place_price is not None and place_price > budget:
                continue

        filtered_places.append(place)

    if filtered_places:
        places = filtered_places

    scored_places = [
        ScoredPlace(place=place, score=_score_place(place, normalized_interests))
        for place in places
    ]
    scored_places.sort(key=lambda item: item.score, reverse=True)

    total_needed = days * stops_per_day
    candidates = scored_places[: max(total_needed * 2, total_needed)]

    day_plans = []
    used_ids = set()
    centroid = _compute_centroid(places)
    for day_number in range(1, days + 1):
        day_places = _build_day_stops(
            candidates=candidates,
            used_ids=used_ids,
            stops_per_day=stops_per_day,
            centroid=centroid,
        )
        if not day_places:
            break

        stops = []
        for item in day_places:
            place = item.place
            stops.append(
                {
                    "id": place.id,
                    "name": place.name,
                    "category": place.category,
                    "rating": place.rating,
                    "address": place.address,
                    "google_place_id": place.google_place_id,
                    "lat": place.lat,
                    "lng": place.lng,
                    "price_level": place.price_level,
                    "opening_hours": place.opening_hours,
                    "photo_url": place.photo_url,
                    "website": place.website,
                    "neighborhood": place.neighborhood,
                    "is_must_visit": place.is_must_visit,
                }
            )

        summary_names = ", ".join(stop["name"] for stop in stops)
        day_plans.append(
            {
                "day": day_number,
                "summary": f"Day {day_number}: {summary_names}",
                "stops": stops,
            }
        )

    tips = []
    if len(day_plans) < days:
        tips.append(
            "Not enough cached places for all days. "
            "Try adding more categories or reduce trip length."
        )
    if not normalized_interests:
        tips.append("Add interests for more personalized results.")

    return {
        "city": city,
        "days_requested": days,
        "days_generated": len(day_plans),
        "budget": budget,
        "interests": normalized_interests,
        "pace": pace_value,
        "travel_style": travel_style,
        "itinerary": day_plans,
        "tips": tips,
    }
