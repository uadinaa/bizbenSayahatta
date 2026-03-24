from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional
from urllib.parse import quote_plus

from places.models import Place
from users.services import calculate_level_and_badges

from .geocoding import geocode_place
from .trip_planner import build_trip_plan


DAY_COLORS = ["#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#3182CE", "#805AD5"]
DAY_EMOJIS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"]
STYLE_KEYWORDS = {
    "adventure": {"adventure", "hiking", "active", "outdoor", "explore"},
    "relaxation": {"relax", "relaxing", "relaxation", "spa", "beach", "chill"},
    "culture": {"culture", "cultural", "museum", "history", "historic", "art"},
    "food": {"food", "foodie", "restaurant", "cuisine", "local food", "street food"},
    "mix": {"mix", "mixed", "everything", "bit of everything"},
}

TRAVEL_TYPE_QUESTIONS = {
    "destination": "Where do you want to go?",
    "budget": "What's your total budget or daily budget?",
    "duration": "What are your travel dates or how many days is the trip?",
    "travelers": "How many people are traveling?",
    "traveler_type": "Is this a solo trip, couple, group of friends, or family with kids?",
    "travel_style": "What travel style do you want: adventure, relaxation, culture, food, or a mix?",
    "kids_age": "Will there be any children? If yes, what age range: toddler, 5-10, or teens?",
}


@dataclass
class TripRequirements:
    destination: str = ""
    budget_total: Optional[int] = None
    duration_days: Optional[int] = None
    travelers: Optional[int] = None
    traveler_type: str = ""
    travel_style: str = ""
    has_kids: bool = False
    kids_age_band: str = ""
    citizenship: str = ""


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _normalized_lower(value: str | None) -> str:
    return _normalize_text(value).lower()


def _extract_destination(text: str, fallback_city: str = "") -> str:
    detected = fallback_city or ""
    candidate_values = Place.objects.exclude(city="").values_list("city", flat=True).distinct()
    for city in sorted(set(candidate_values), key=len, reverse=True):
        if city.lower() in text.lower():
            detected = city
            break
    return detected


def _extract_budget(text: str) -> Optional[int]:
    patterns = [
        r"\$ ?(\d{2,6})",
        r"(\d{2,6})\s*(usd|dollars|\$)",
        r"budget[^0-9]{0,10}(\d{2,6})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None


def _extract_duration_days(text: str) -> Optional[int]:
    day_match = re.search(r"(\d{1,2})\s*(day|days|night|nights)\b", text, flags=re.IGNORECASE)
    if day_match:
        return int(day_match.group(1))

    week_match = re.search(r"(\d{1,2})\s*(week|weeks)\b", text, flags=re.IGNORECASE)
    if week_match:
        return int(week_match.group(1)) * 7

    date_match = re.search(
        r"(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    if date_match:
        start = date.fromisoformat(date_match.group(1))
        end = date.fromisoformat(date_match.group(2))
        delta = (end - start).days + 1
        return delta if delta > 0 else None
    return None


def _extract_travelers(text: str) -> Optional[int]:
    direct = re.search(r"(\d{1,2})\s*(people|traveler|travelers|persons|adults)\b", text, flags=re.IGNORECASE)
    if direct:
        return int(direct.group(1))

    lowered = text.lower()
    if "solo" in lowered or "myself" in lowered:
        return 1
    if "couple" in lowered:
        return 2

    count = 0
    if re.search(r"\bme\b|\bi\b", lowered):
        count += 1
    if re.search(r"\b(my wife|my husband|my partner|girlfriend|boyfriend)\b", lowered):
        count += 1
    child_mentions = re.findall(r"(\d+)-year-old|kids|children|child|toddler|teen", lowered)
    if child_mentions:
        ages = re.findall(r"(\d+)-year-old", lowered)
        if ages:
            count += len(ages)
        elif any(token in lowered for token in {"kids", "children", "child", "toddler", "teen"}):
            count += 1

    return count or None


def _extract_traveler_type(text: str) -> tuple[str, bool]:
    lowered = text.lower()
    if any(token in lowered for token in {"family", "kids", "children", "child", "toddler", "teen"}):
        return "family", True
    if "couple" in lowered or re.search(r"\b(my wife|my husband|my partner)\b", lowered):
        return "couple", False
    if any(token in lowered for token in {"friends", "group", "girls trip", "boys trip"}):
        return "group", False
    if "solo" in lowered or "myself" in lowered:
        return "solo", False
    return "", False


def _extract_travel_style(text: str, fallback: str = "") -> str:
    lowered = text.lower()
    for style, keywords in STYLE_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return style
    return fallback


def _extract_kids_age_band(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in {"toddler", "stroller", "baby"}):
        return "toddler"
    if any(token in lowered for token in {"teen", "teens"}):
        return "teens"

    ages = [int(age) for age in re.findall(r"(\d+)-year-old", lowered)]
    if ages:
        max_age = max(ages)
        if max_age <= 4:
            return "toddler"
        if max_age <= 10:
            return "child"
        return "teens"

    if re.search(r"\b(5 ?[-to]{0,3} ?10)\b", lowered):
        return "child"
    return ""


def _extract_citizenship(text: str, fallback: str = "") -> str:
    lowered = text.lower()
    match = re.search(r"(russian|kazakh|kazakhstani|us|american|ukrainian|turkish)\s+passport", lowered)
    if not match:
        return fallback
    mapping = {
        "russian": "Russia",
        "kazakh": "Kazakhstan",
        "kazakhstani": "Kazakhstan",
        "us": "United States",
        "american": "United States",
        "ukrainian": "Ukraine",
        "turkish": "Turkey",
    }
    return mapping.get(match.group(1), fallback)


def collect_trip_requirements(
    *,
    text: str,
    fallback_city: str = "",
    fallback_style: str = "",
    fallback_citizenship: str = "",
) -> TripRequirements:
    traveler_type, has_kids = _extract_traveler_type(text)
    return TripRequirements(
        destination=_extract_destination(text, fallback_city=fallback_city),
        budget_total=_extract_budget(text),
        duration_days=_extract_duration_days(text),
        travelers=_extract_travelers(text),
        traveler_type=traveler_type,
        travel_style=_extract_travel_style(text, fallback=fallback_style),
        has_kids=has_kids,
        kids_age_band=_extract_kids_age_band(text),
        citizenship=_extract_citizenship(text, fallback=fallback_citizenship),
    )


def get_missing_requirements(requirements: TripRequirements) -> List[str]:
    missing = []
    if not requirements.destination:
        missing.append("destination")
    if requirements.budget_total is None:
        missing.append("budget")
    if requirements.duration_days is None:
        missing.append("duration")
    if requirements.travelers is None:
        missing.append("travelers")
    if not requirements.traveler_type:
        missing.append("traveler_type")
    if not requirements.travel_style:
        missing.append("travel_style")
    if requirements.has_kids and not requirements.kids_age_band:
        missing.append("kids_age")
    return missing


def build_missing_details_response(missing: Iterable[str]) -> str:
    lines = [
        "Before I build your trip, I need a few more details:",
    ]
    for field in missing:
        question = TRAVEL_TYPE_QUESTIONS.get(field)
        if question:
            lines.append(f"- {question}")
    lines.append("Let me know and I'll get started! 🗺️")
    return "\n".join(lines)


def _budget_to_price_level(total_budget: Optional[int], days: int) -> Optional[int]:
    if total_budget is None:
        return None
    if total_budget <= 4:
        return total_budget

    per_day = total_budget / max(days, 1)
    if per_day <= 25:
        return 0
    if per_day <= 90:
        return 1
    if per_day <= 180:
        return 2
    if per_day <= 350:
        return 3
    return 4


def _country_for_destination(destination: str) -> str:
    place = (
        Place.objects.filter(city__iexact=destination)
        .exclude(country="")
        .order_by("-rating", "-user_ratings_total")
        .first()
    )
    return place.country if place else destination


def _google_maps_link(stop: Dict[str, object]) -> str:
    place_id = stop.get("google_place_id")
    if place_id:
        return (
            "https://www.google.com/maps/search/?api=1"
            f"&query_place_id={quote_plus(str(place_id))}"
        )
    query = quote_plus(f"{stop.get('name', '')} {stop.get('address', '')}")
    return f"https://www.google.com/maps/search/?api=1&query={query}"


def _country_slug(country: str) -> str:
    mapping = {
        "United States": "usa",
        "United Kingdom": "united-kingdom",
        "South Korea": "south-korea",
        "United Arab Emirates": "united-arab-emirates",
    }
    if country in mapping:
        return mapping[country]
    return country.lower().replace("&", "and").replace("'", "").replace(" ", "-")


def _travel_advisory_link(country: str) -> str:
    return f"https://www.gov.uk/foreign-travel-advice/{_country_slug(country)}"


def _visa_info(country: str, citizenship: str) -> Dict[str, str]:
    country_key = country.lower()
    citizenship_key = citizenship.lower()
    if not citizenship:
        return {
            "status": "citizenship_needed",
            "label": "What's your citizenship/passport? I'll check visa requirements.",
            "url": "",
        }

    specific_required = {
        ("united states", "russia"): (
            "Visa required for Russian passport holders",
            "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html",
        ),
    }

    visa_free = {
        ("thailand", "kazakhstan"),
        ("japan", "united states"),
        ("indonesia", "kazakhstan"),
    }

    if (country_key, citizenship_key) in visa_free:
        return {
            "status": "not_required",
            "label": f"No visa required for {citizenship} citizens",
            "url": "",
        }

    if (country_key, citizenship_key) in specific_required:
        label, url = specific_required[(country_key, citizenship_key)]
        return {"status": "required", "label": label, "url": url}

    return {
        "status": "unknown",
        "label": f"Please verify visa requirements for {country}",
        "url": _travel_advisory_link(country),
    }


def _safety_tips(destination: str, country: str, has_kids: bool) -> List[str]:
    key = destination.lower() or country.lower()
    mapped = {
        "thailand": [
            "Stick to busy street-food stalls and avoid raw shellfish to keep stomach issues low-risk.",
            "Use Grab or hotel-booked taxis late at night instead of negotiating on the street.",
            "Keep small cash handy for markets and temples, but split larger bills across bags.",
            "Share your day plan and keep offline copies of passports and hotel addresses.",
        ],
        "morocco": [
            "Use official taxis or agree on the meter before starting rides in busy medina areas.",
            "Keep bags zipped and in front of you in crowded souks.",
            "Choose licensed guides for medina tours if you want help navigating confidently.",
            "Carry water and sun protection for longer walking days.",
        ],
        "mexico city": [
            "Use Uber or DiDi instead of unmarked street taxis, especially after dark.",
            "Keep phones and jewelry low-key in crowded transit areas.",
            "Stay on well-lit main streets for evening walks.",
            "Carry digital and paper copies of key travel documents.",
        ],
        "bali": [
            "Drink bottled water, even for brushing teeth in smaller stays.",
            "Secure sunglasses and snacks around monkey temple areas.",
            "Rent scooters only from reputable shops and check fuel quality before long rides.",
            "Use reef-safe sunscreen and stay hydrated in humid weather.",
        ],
        "egypt": [
            "Carry water and sun protection for temple days to avoid heat exhaustion.",
            "Dress modestly for mosques and religious sites.",
            "Use hotel-arranged or app-based rides when possible.",
            "Keep some small cash ready for tips and restroom stops.",
        ],
        "japan": [
            "Keep a backup battery and offline route screenshots for long station transfers.",
            "Carry some cash because smaller family restaurants may not accept cards.",
            "Plan snack and restroom breaks around train transfers for smoother family days.",
            "Keep hotel address cards handy for taxi rides and late returns.",
        ],
    }

    tips = mapped.get(key) or mapped.get(country.lower()) or [
        "Share your itinerary with someone at home and keep digital plus paper copies of documents.",
        "Use official transport apps or hotel-arranged rides for late arrivals.",
        "Keep a small day budget in an easy-access pocket and store the rest separately.",
        "Check local weather and dress code before each day's stops.",
    ]
    if has_kids:
        tips = tips[:3] + ["Pack water, wipes, and a backup snack plan for child-friendly pacing."]
    return tips[:5]


def _format_history_line(user) -> str:
    profile = calculate_level_and_badges(user)
    history_prompt = profile.get("history_prompt", "")
    preferences = getattr(user, "preferences", None)
    if preferences and preferences.travel_style and not history_prompt:
        history_prompt = (
            "Based on your past trips, you usually prefer "
            f"{preferences.travel_style.lower()} experiences."
        )
    return history_prompt


def _build_sources(plan: Dict[str, object], country: str, citizenship: str) -> Dict[str, object]:
    items = []
    seen = set()
    for day in plan.get("itinerary", []):
        for stop in day.get("stops", []):
            key = stop.get("name")
            if not key or key in seen:
                continue
            seen.add(key)
            items.append(
                {
                    "label": str(stop.get("name")),
                    "type": "place",
                    "provider": "Google Maps",
                    "url": _google_maps_link(stop),
                }
            )
    visa = _visa_info(country, citizenship)
    return {
        "title": "Sources & Useful Links",
        "items": items[:6],
        "visa": visa,
        "advisory": {
            "label": f"Travel advisory for {country}",
            "url": _travel_advisory_link(country),
        },
    }


def _route_places_for_day(day: Dict[str, object]) -> List[Dict[str, object]]:
    places = []
    for stop in day.get("stops", []):
        lat = stop.get("lat")
        lng = stop.get("lng")
        if lat is None or lng is None:
            geocoded = geocode_place(
                stop.get("name", ""),
                city=stop.get("city", ""),
                country=stop.get("country", ""),
            )
            if not geocoded:
                continue
            lat = geocoded["lat"]
            lng = geocoded["lng"]

        places.append(
            {
                "name": stop.get("name"),
                "lat": float(lat),
                "lng": float(lng),
                "address": stop.get("address", ""),
            }
        )
    return places


def _build_route(plan: Dict[str, object]) -> List[Dict[str, object]]:
    route = []
    for index, day in enumerate(plan.get("itinerary", [])):
        route_places = _route_places_for_day(day)
        route.append(
            {
                "day": day["day"],
                "color": DAY_COLORS[index % len(DAY_COLORS)],
                "places": route_places,
            }
        )
    return route


def _format_trip_response(plan: Dict[str, object]) -> str:
    lines = []
    history_line = plan.get("history_line")
    if history_line:
        lines.append(f"{history_line} I've shaped this trip around it.")
        lines.append("")

    lines.append(f"## Final Trip for {plan.get('city')}")
    lines.append(
        f"{plan.get('travelers')} traveler(s), {plan.get('duration_days')} days, "
        f"{plan.get('travel_style')} style"
    )
    lines.append("")

    if plan.get("family_note"):
        lines.append(plan["family_note"])
        lines.append("")

    for day in plan.get("itinerary", []):
        emoji = day.get("color_emoji", "🔵")
        lines.append(f"### Day {day['day']} {emoji}")
        lines.append(day.get("summary") or "")
        for stop in day.get("stops", []):
            lines.append(f"- {stop['name']} — {stop['address']}")
        lines.append("")

    lines.append("## 📚 Sources & Useful Links")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    for item in plan["sources"]["items"]:
        lines.append(f"📍 [{item['label']}]({item['url']}) — {item['provider']}")

    visa = plan["sources"]["visa"]
    if visa["status"] == "required":
        lines.append(f"🛂 {visa['label']} → [link]({visa['url']})")
    elif visa["status"] == "not_required":
        lines.append(f"✅ {visa['label']}")
    elif visa["url"]:
        lines.append(f"🛂 {visa['label']} → [link]({visa['url']})")
    else:
        lines.append(f"🛂 {visa['label']}")
    lines.append(
        f"📋 [{plan['sources']['advisory']['label']}]({plan['sources']['advisory']['url']})"
    )
    lines.append("")

    lines.append(f"## ⚠️ Safety Tips for {plan.get('city')}")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    for tip in plan.get("safety_tips", []):
        lines.append(f"• {tip}")

    if plan.get("partial_note"):
        lines.append("")
        lines.append(plan["partial_note"])

    if plan.get("needs_citizenship"):
        lines.append("")
        lines.append("What's your citizenship/passport? I'll add a more precise visa check.")

    return "\n".join(lines).strip()


def generate_trip_payload(*, user, requirements: TripRequirements) -> Dict[str, object]:
    days = requirements.duration_days or 3
    price_level_budget = _budget_to_price_level(requirements.budget_total, days)
    pace = "slow" if requirements.has_kids else "medium"
    country = _country_for_destination(requirements.destination)

    history_line = _format_history_line(user)

    plan = build_trip_plan(
        user=user,
        city=requirements.destination,
        days=days,
        budget=price_level_budget,
        pace=pace,
        travel_style=requirements.travel_style,
        traveler_type=requirements.traveler_type,
        has_kids=requirements.has_kids,
        kids_age_band=requirements.kids_age_band or ("child" if requirements.has_kids else ""),
    )

    partial_note = ""
    if plan["days_generated"] < days:
        retry_plan = build_trip_plan(
            user=user,
            city=requirements.destination,
            days=days,
            budget=price_level_budget,
            pace="slow",
            travel_style=requirements.travel_style,
            traveler_type=requirements.traveler_type,
            has_kids=requirements.has_kids,
            kids_age_band=requirements.kids_age_band or ("child" if requirements.has_kids else ""),
        )
        if retry_plan["days_generated"] >= plan["days_generated"]:
            plan = retry_plan
        if plan["days_generated"] < days:
            partial_note = (
                f"I could only confirm {plan['days_generated']} day(s) from the cached place data, "
                "so I’m sharing the strongest partial route for now."
            )

    for index, day in enumerate(plan.get("itinerary", [])):
        color = DAY_COLORS[index % len(DAY_COLORS)]
        day["color"] = color
        day["color_emoji"] = DAY_EMOJIS[index % len(DAY_EMOJIS)]

    family_note = "Family-friendly filters applied ✅" if requirements.has_kids else ""
    safety_tips = _safety_tips(requirements.destination, country, requirements.has_kids)
    sources = _build_sources(plan, country, requirements.citizenship)
    needs_citizenship = sources["visa"]["status"] == "citizenship_needed"
    route = _build_route(plan)

    payload = {
        **plan,
        "country": country,
        "duration_days": days,
        "travelers": requirements.travelers,
        "traveler_type": requirements.traveler_type,
        "travel_style": requirements.travel_style,
        "family_note": family_note,
        "history_line": history_line,
        "safety_tips": safety_tips,
        "route": route,
        "sources": sources,
        "needs_citizenship": needs_citizenship,
        "partial_note": partial_note,
        "generated_at": datetime.utcnow().isoformat(),
    }
    payload["response_markdown"] = _format_trip_response(payload)
    return payload
