from dataclasses import dataclass
from typing import Iterable, List, Optional

from places.models import Place
from users.models import UserPreferences


PACE_TO_STOPS = {
    "slow": 3,
    "medium": 4,
    "fast": 5,
}


@dataclass
class ScoredPlace:
    place: Place
    score: float


def _normalize_interests(interests: Optional[Iterable[str]]) -> List[str]:
    if not interests:
        return []
    return [value.strip().lower() for value in interests if value.strip()]


def _place_matches_interest(place: Place, interests: List[str]) -> bool:
    if not interests:
        return False
    category = (place.category or "").lower()
    types = [value.lower() for value in (place.types or [])]
    for interest in interests:
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
    index = 0
    for day_number in range(1, days + 1):
        day_places = candidates[index : index + stops_per_day]
        index += stops_per_day
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
