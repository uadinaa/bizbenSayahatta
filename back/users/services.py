from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

from django.db.models import Q


LEVELS = [
    {
        "rank": 1,
        "name": "Explorer",
        "icon": "🌱",
        "min_trips": 0,
    },
    {
        "rank": 2,
        "name": "Voyager",
        "icon": "✈️",
        "min_trips": 3,
    },
    {
        "rank": 3,
        "name": "Navigator",
        "icon": "🗺️",
        "min_trips": 10,
        "min_countries": 5,
    },
    {
        "rank": 4,
        "name": "Globetrotter",
        "icon": "🌍",
        "min_trips": 25,
        "min_countries": 15,
    },
    {
        "rank": 5,
        "name": "Legend",
        "icon": "⭐",
        "min_trips": 50,
    },
]


ASIA_COUNTRIES = {
    "japan",
    "thailand",
    "indonesia",
    "singapore",
    "south korea",
    "vietnam",
    "malaysia",
    "china",
    "india",
    "kazakhstan",
    "uzbekistan",
    "uae",
    "united arab emirates",
}

FOOD_DESTINATIONS = {
    "tokyo",
    "osaka",
    "bangkok",
    "singapore",
    "istanbul",
    "seoul",
    "rome",
    "paris",
    "mexico city",
}

RARE_DESTINATIONS = {
    "bhutan",
    "mongolia",
    "faroe islands",
    "antarctica",
    "greenland",
    "madagascar",
}


def _normalize_text(value: str | None) -> str:
    return (value or "").strip().lower()


def _get_user_trip_records(user) -> List[Dict[str, Any]]:
    from marketplace.models import Trip
    from places.models import UserMapPlace, VisitedPlace

    records: List[Dict[str, Any]] = []

    for row in UserMapPlace.objects.filter(user=user):
        records.append(
            {
                "destination": _normalize_text(row.city),
                "country": _normalize_text(row.country),
                "style": "",
                "budget": None,
                "family": False,
            }
        )

    for row in Trip.objects.filter(Q(customer_user=user) | Q(advisor=user)):
        itinerary = row.itinerary_json or {}
        meta = itinerary.get("meta", {}) if isinstance(itinerary, dict) else {}
        records.append(
            {
                "destination": _normalize_text(row.destination),
                "country": _normalize_text(meta.get("country") or row.destination),
                "style": _normalize_text(meta.get("travel_style")),
                "budget": float(row.price or 0),
                "family": bool(meta.get("traveler_type") == "family" or meta.get("has_kids")),
            }
        )

    # Visited places still count toward destination history even if no explicit trip object exists.
    for row in (
        VisitedPlace.objects.filter(user=user)
        .select_related("place")
        .order_by("-created_at")
    ):
        records.append(
            {
                "destination": _normalize_text(row.place.city),
                "country": _normalize_text(row.place.country),
                "style": "",
                "budget": None,
                "family": False,
                "category": _normalize_text(row.place.category),
            }
        )

    return records


def calculate_level_and_badges(user) -> Dict[str, Any]:
    records = _get_user_trip_records(user)
    preferences = getattr(user, "preferences", None)

    unique_trip_keys = {
        (record.get("destination") or "", record.get("country") or "")
        for record in records
        if record.get("destination") or record.get("country")
    }
    trip_count = len(unique_trip_keys)
    countries = sorted(
        {
            record.get("country")
            for record in records
            if record.get("country")
        }
    )
    country_count = len(countries)

    level = LEVELS[0]
    for candidate in LEVELS:
        min_countries = candidate.get("min_countries", 0)
        if trip_count >= candidate["min_trips"] and country_count >= min_countries:
            level = candidate

    destinations = Counter(record.get("destination") for record in records if record.get("destination"))
    categories = Counter(record.get("category") for record in records if record.get("category"))
    styles = Counter(record.get("style") for record in records if record.get("style"))

    badge_defs = []

    beach_count = sum(1 for name in destinations if name in {"bali", "phuket", "goa", "maldives"})
    if beach_count >= 3:
        badge_defs.append({"code": "beach_lover", "label": "Beach Lover", "icon": "🏖️"})

    mountain_count = sum(1 for value in categories if value in {"park", "natural_feature", "mountain"})
    if mountain_count >= 3:
        badge_defs.append({"code": "mountain_seeker", "label": "Mountain Seeker", "icon": "🏔️"})

    food_count = sum(1 for name in destinations if name in FOOD_DESTINATIONS)
    if food_count >= 5:
        badge_defs.append({"code": "food_traveler", "label": "Food Traveler", "icon": "🍜"})

    family_count = sum(1 for record in records if record.get("family"))
    if family_count >= 2:
        badge_defs.append({"code": "family_traveler", "label": "Family Traveler", "icon": "👨‍👩‍👧"})

    budget_count = sum(1 for record in records if record.get("budget") is not None and record["budget"] <= 500)
    if budget_count >= 3:
        badge_defs.append({"code": "budget_master", "label": "Budget Master", "icon": "💰"})

    asia_count = sum(1 for country in countries if country in ASIA_COUNTRIES)
    if asia_count >= 3:
        badge_defs.append({"code": "asia_explorer", "label": "Asia Explorer", "icon": "🌏"})

    top_styles = [style for style, _ in styles.most_common(2)]
    history_prompt = ""
    if top_styles:
        history_prompt = (
            "Based on your past trips, you often prefer "
            f"{' and '.join(top_styles)} experiences."
        )
    elif preferences and preferences.travel_style:
        history_prompt = (
            "Based on your past trips, you usually lean toward "
            f"{preferences.travel_style.lower()} travel."
        )

    if any(destination in RARE_DESTINATIONS for destination in destinations):
        level = LEVELS[-1]

    return {
        "traveler_level": {
            "rank": level["rank"],
            "name": level["name"],
            "icon": level["icon"],
        },
        "badges": badge_defs,
        "history_summary": {
            "trip_count": trip_count,
            "country_count": country_count,
            "countries": countries,
        },
        "history_prompt": history_prompt,
    }


def sync_user_travel_profile(user) -> Dict[str, Any]:
    profile = calculate_level_and_badges(user)
    preferences = user.preferences
    preferences.traveler_level = profile["traveler_level"]["name"]
    preferences.badges = profile["badges"]
    preferences.save(update_fields=["traveler_level", "badges", "updated_at"])
    return profile
