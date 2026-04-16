from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional
from urllib.parse import quote_plus

from django.conf import settings
from openai import OpenAI
from places.models import Place
from users.services import calculate_level_and_badges

from .geocoding import geocode_place
from .trip_planner import build_trip_plan

# Initialize OpenAI for fuzzy extraction
client = OpenAI(api_key=settings.OPENAI_API_KEY)


# Fuzzy matching mappings for common typos
TRAVEL_TYPE_TYPOS = {
    "silo": "solo",
    "solos": "solo",
    "sool": "solo",
    "sollo": "solo",
    "cupel": "couple",
    "cuple": "couple",
    "couple": "couple",
    "familia": "family",
    "familiy": "family",
    "famlly": "family",
    "famili": "family",
    "group": "group",
    "grop": "group",
    "grouop": "group",
    "freinds": "friends",
    "freinds trip": "group",
}

TRAVEL_STYLE_TYPOS = {
    "adventure": "adventure",
    "adventur": "adventure",
    "adventue": "adventure",
    "adventrue": "adventure",
    "hiking": "adventure",
    "active": "adventure",
    "activ": "adventure",
    "outdoor": "adventure",
    "explore": "adventure",
    "relax": "relaxation",
    "relaxing": "relaxation",
    "relaxation": "relaxation",
    "relaxs": "relaxation",
    "relx": "relaxation",
    "chill": "relaxation",
    "spa": "relaxation",
    "beach": "relaxation",
    "culture": "culture",
    "cultural": "culture",
    "museum": "culture",
    "musem": "culture",
    "history": "culture",
    "historic": "culture",
    "art": "culture",
    "food": "food",
    "foodie": "food",
    "foodies": "food",
    "restaurant": "food",
    "resturant": "food",
    "cuisine": "food",
    "local food": "food",
    "street food": "food",
    "mix": "mix",
    "mixed": "mix",
    "everything": "mix",
    "bit of everything": "mix",
    "all": "mix",
}


def _fuzzy_match_travel_type(text: str) -> str:
    """Match travel type with fuzzy matching for typos."""
    lowered = text.lower()

    # First try direct fuzzy matching
    for typo, correct in TRAVEL_TYPE_TYPOS.items():
        if typo in lowered:
            return correct

    # Try phonetic-like matching for "solo"
    if any(pattern in lowered for pattern in ["sl", "slo", "so lo", "s olo"]):
        return "solo"

    # Try phonetic-like matching for "couple"
    if any(pattern in lowered for pattern in ["cpl", "cupl", "coupl", "cpel"]):
        return "couple"

    return ""


def _fuzzy_match_travel_style(text: str) -> str:
    """Match travel style with fuzzy matching for typos."""
    lowered = text.lower()

    # First try direct fuzzy matching
    for typo, correct in TRAVEL_STYLE_TYPOS.items():
        if typo in lowered:
            return correct

    # Try phonetic-like matching
    if any(pattern in lowered for pattern in ["advnt", "advnture", "advencure"]):
        return "adventure"
    if any(pattern in lowered for pattern in ["relx", "relax", "rilax"]):
        return "relaxation"
    if any(pattern in lowered for pattern in ["cultr", "culutre", "clture"]):
        return "culture"
    if any(pattern in lowered for pattern in ["fod", "foood", "fud"]):
        return "food"

    return ""


def _ai_extract_params(text: str) -> dict:
    """
    Use OpenAI to extract structured data from user message.
    Handles typos, misspellings, and ambiguous input.
    """
    prompt = f"""
Extract travel parameters from this user message. Return JSON only.

User message: "{text}"

Extract these fields:
- destination: city name (or null)
- budget: total budget as integer (or null)
- duration_days: number of days as integer (or null)
- start_date: start date as ISO string "YYYY-MM-DD" (or null)
- end_date: end date as ISO string "YYYY-MM-DD" (or null)
- travelers: number of travelers as integer (or null)
- traveler_type: one of "solo", "couple", "family", "group" (or null)
- travel_style: one of "adventure", "relaxation", "culture", "food", "mix" (or null)
- has_kids: boolean (or null)
- needs_hotel: boolean - true if user mentions hotel/accommodation, false if they say they don't need it (or null if not mentioned)

IMPORTANT: Handle typos and misspellings. For example:
- "silo" = "solo", "cupel" = "couple", "familia" = "family"
- "adventur" = "adventure", "relx" = "relaxation", "cultr" = "culture"
- Dates: "8th May till 12th" = start_date: "YYYY-05-08", end_date: "YYYY-05-12"
- Dates: "08.05-12.05" = start_date: "YYYY-05-08", end_date: "YYYY-05-12"
- Hotel: "I need a hotel" = needs_hotel: true, "I have a place to stay" = needs_hotel: false

Return ONLY valid JSON, no markdown, no explanation.
"""

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=[
                {
                    "role": "system",
                    "content": [
                        {"type": "input_text", "text": "You are a travel data extractor. Extract parameters and return JSON only, no markdown."}
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt}
                    ],
                },
            ],
            temperature=0.1,
        )

        import json
        import re
        # Strip markdown code blocks if present
        output = response.output_text.strip()
        output = re.sub(r'^```json\s*', '', output)
        output = re.sub(r'^```\s*', '', output)
        output = re.sub(r'\s*```$', '', output)
        result = json.loads(output)
        return result
    except Exception:
        return {}


DAY_COLORS = ["#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#3182CE", "#805AD5"]
DAY_EMOJIS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚪️", "⚫️", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫"]

STYLE_KEYWORDS = {
    "adventure": {"adventure", "hiking", "active", "outdoor", "explore"},
    "relaxation": {"relax", "relaxing", "relaxation", "spa", "beach", "chill"},
    "culture": {"culture", "cultural", "museum", "history", "historic", "art"},
    "food": {"food", "foodie", "restaurant", "cuisine", "local food", "street food"},
    "mix": {"mix", "mixed", "everything", "bit of everything"},
}

HOTEL_STYLE_KEYWORDS = {
    "active": {"active", "hiking", "mountain", "nature", "outdoor", "trekking", "climbing"},
    "relaxed": {"relax", "relaxing", "relaxation", "spa", "beach", "chill", "peaceful"},
    "cultural": {"culture", "cultural", "museum", "history", "historic", "art", "city center"},
    "budget": {"budget", "cheap", "affordable", "low cost", "economical"},
    "family": {"family", "kids", "children", "child-friendly", "family rooms"},
}

TRAVEL_TYPE_QUESTIONS = {
    "destination": "Where do you want to go?",
    "budget": "What's your total budget or daily budget?",
    "duration": "What are your travel dates or how many days is the trip?",
    "travelers": "How many people are traveling?",
    "traveler_type": "Is this a solo trip, couple, group of friends, or family with kids?",
    "travel_style": "What travel style do you want: adventure, relaxation, culture, food, or a mix?",
    "kids_age": "Will there be any children? If yes, what age range: toddler, 5-10, or teens?",
    "hotel": "Do you need hotel recommendations for your stay?",
}


@dataclass
class TripRequirements:
    destination: str = ""
    budget_total: Optional[int] = None
    duration_days: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    travelers: Optional[int] = None
    traveler_type: str = ""
    travel_style: str = ""
    has_kids: bool = False
    kids_age_band: str = ""
    citizenship: str = ""
    needs_hotel: bool = True  # Default to True, chat will ask
    hotel_requested: bool = False  # User explicitly asked for hotel

@dataclass
class HotelSearchParams:
    """Parameters extracted from user message for hotel search."""
    city: Optional[str] = None
    checkin: Optional[str] = None
    checkout: Optional[str] = None
    budget_per_night: Optional[float] = None
    adults: Optional[int] = None
    children: Optional[int] = None
    travel_style: Optional[str] = None


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


MONTH_NAMES = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12,
}

# Spelled-out numbers for duration extraction
NUMBER_WORDS = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60,
}

def _parse_date_string(text: str) -> Optional[date]:
    """Parse various date formats and return a date object."""
    text = text.strip().lower()

    # Try ISO format: YYYY-MM-DD
    try:
        return date.fromisoformat(text)
    except ValueError:
        pass

    # Try DD.MM or DD/MM (assume current year)
    match = re.match(r"(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?", text)
    if match:
        day, month = int(match.group(1)), int(match.group(2))
        year = int(match.group(3)) if match.group(3) else datetime.now().year
        try:
            return date(year, month, day)
        except ValueError:
            pass

    # Try "8th May", "May 8", "8 May" format
    match = re.match(r"(\d{1,2})(?:st|nd|rd|th)?\s*(\w+)", text)
    if match:
        day = int(match.group(1))
        month_str = match.group(2).lower()
        month = MONTH_NAMES.get(month_str) or MONTH_NAMES.get(month_str[:3])
        if month:
            year = datetime.now().year
            try:
                return date(year, month, day)
            except ValueError:
                pass

    # Try "May 8th", "May 8" format
    match = re.match(r"(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?", text)
    if match:
        month_str = match.group(1).lower()
        day = int(match.group(2))
        month = MONTH_NAMES.get(month_str) or MONTH_NAMES.get(month_str[:3])
        if month:
            year = datetime.now().year
            try:
                return date(year, month, day)
            except ValueError:
                pass

    return None


def _extract_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """Extract start and end dates as ISO strings from various formats."""

    # Format: "8th May till 12th" or "8th May to 12th May"
    date_range_match = re.search(
        r"(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(?:till|to|-)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\w+))?",
        text,
        flags=re.IGNORECASE,
    )
    if date_range_match:
        start_day = int(date_range_match.group(1))
        start_month_str = date_range_match.group(2).lower()
        end_day = int(date_range_match.group(3))
        end_month_str = date_range_match.group(4).lower() if date_range_match.group(4) else start_month_str

        start_month = MONTH_NAMES.get(start_month_str) or MONTH_NAMES.get(start_month_str[:3])
        end_month = MONTH_NAMES.get(end_month_str) or MONTH_NAMES.get(end_month_str[:3])

        if start_month and end_month:
            year = datetime.now().year
            try:
                start_date = date(year, start_month, start_day)
                end_date = date(year, end_month, end_day)
                return start_date.isoformat(), end_date.isoformat()
            except ValueError:
                pass

    # Format: "May 8 to May 12" or "May 8th to May 12th"
    month_day_range_match = re.search(
        r"(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:till|to|-)\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?",
        text,
        flags=re.IGNORECASE,
    )
    if month_day_range_match:
        start_month_str = month_day_range_match.group(1).lower()
        start_day = int(month_day_range_match.group(2))
        end_month_str = month_day_range_match.group(3).lower()
        end_day = int(month_day_range_match.group(4))

        start_month = MONTH_NAMES.get(start_month_str) or MONTH_NAMES.get(start_month_str[:3])
        end_month = MONTH_NAMES.get(end_month_str) or MONTH_NAMES.get(end_month_str[:3])

        if start_month and end_month:
            year = datetime.now().year
            try:
                start_date = date(year, start_month, start_day)
                end_date = date(year, end_month, end_day)
                return start_date.isoformat(), end_date.isoformat()
            except ValueError:
                pass

    # Format: "08.05-12.05" or "08.05 till 12.05"
    dd_mm_range_match = re.search(
        r"(\d{1,2})[./](\d{1,2})\s*(?:till|to|-)\s*(\d{1,2})[./](\d{1,2})",
        text,
        flags=re.IGNORECASE,
    )
    if dd_mm_range_match:
        start_day, start_month = int(dd_mm_range_match.group(1)), int(dd_mm_range_match.group(2))
        end_day, end_month = int(dd_mm_range_match.group(3)), int(dd_mm_range_match.group(4))
        year = datetime.now().year
        try:
            start_date = date(year, start_month, start_day)
            end_date = date(year, end_month, end_day)
            return start_date.isoformat(), end_date.isoformat()
        except ValueError:
            pass

    # Format: YYYY-MM-DD to YYYY-MM-DD
    iso_date_match = re.search(
        r"(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    if iso_date_match:
        try:
            start = date.fromisoformat(iso_date_match.group(1))
            end = date.fromisoformat(iso_date_match.group(2))
            return start.isoformat(), end.isoformat()
        except ValueError:
            pass

    return None, None


def _extract_duration_days(text: str) -> Optional[int]:
    # First try to extract date range from various formats
    # Format: "8th May till 12th" or "8th May to 12th May"
    date_range_match = re.search(
        r"(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(?:till|to|-)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\w+))?",
        text,
        flags=re.IGNORECASE,
    )
    if date_range_match:
        start_day = int(date_range_match.group(1))
        start_month_str = date_range_match.group(2).lower()
        end_day = int(date_range_match.group(3))
        end_month_str = date_range_match.group(4).lower() if date_range_match.group(4) else start_month_str

        start_month = MONTH_NAMES.get(start_month_str) or MONTH_NAMES.get(start_month_str[:3])
        end_month = MONTH_NAMES.get(end_month_str) or MONTH_NAMES.get(end_month_str[:3])

        if start_month and end_month:
            year = datetime.now().year
            try:
                start_date = date(year, start_month, start_day)
                end_date = date(year, end_month, end_day)
                delta = (end_date - start_date).days + 1
                return delta if delta > 0 else None
            except ValueError:
                pass

    # Format: "08.05-12.05" or "08.05 till 12.05"
    dd_mm_range_match = re.search(
        r"(\d{1,2})[./](\d{1,2})\s*(?:till|to|-)\s*(\d{1,2})[./](\d{1,2})",
        text,
        flags=re.IGNORECASE,
    )
    if dd_mm_range_match:
        start_day, start_month = int(dd_mm_range_match.group(1)), int(dd_mm_range_match.group(2))
        end_day, end_month = int(dd_mm_range_match.group(3)), int(dd_mm_range_match.group(4))
        year = datetime.now().year
        try:
            start_date = date(year, start_month, start_day)
            end_date = date(year, end_month, end_day)
            delta = (end_date - start_date).days + 1
            return delta if delta > 0 else None
        except ValueError:
            pass

    # Format: YYYY-MM-DD to YYYY-MM-DD
    iso_date_match = re.search(
        r"(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    if iso_date_match:
        try:
            start = date.fromisoformat(iso_date_match.group(1))
            end = date.fromisoformat(iso_date_match.group(2))
            delta = (end - start).days + 1
            return delta if delta > 0 else None
        except ValueError:
            pass

    # Direct day/night mention (numeric): "7 days", "5 nights"
    day_match = re.search(r"(\d{1,2})\s*(day|days|night|nights)\b", text, flags=re.IGNORECASE)
    if day_match:
        return int(day_match.group(1))

    # Spelled-out day/night mention: "four days", "five nights", "seven days"
    lowered = text.lower()
    for word, num in NUMBER_WORDS.items():
        if re.search(rf"\b{word}\s*(day|days|night|nights)\b", lowered):
            return num

    # Spelled-out week mention: "two weeks", "three weeks"
    for word, num in NUMBER_WORDS.items():
        if re.search(rf"\b{word}\s*(week|weeks)\b", lowered):
            return num * 7

    # Numeric week mention
    week_match = re.search(r"(\d{1,2})\s*(week|weeks)\b", text, flags=re.IGNORECASE)
    if week_match:
        return int(week_match.group(1)) * 7

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

    # Try fuzzy matching for typos like "silo"
    if _fuzzy_match_travel_type(text) == "solo":
        return 1
    if _fuzzy_match_travel_type(text) == "couple":
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

    if count:
        return count

    # Try AI extraction as final fallback
    ai_result = _ai_extract_params(text)
    ai_travelers = ai_result.get("travelers")
    if ai_travelers:
        return int(ai_travelers)

    return None


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

    # Try fuzzy matching for typos
    fuzzy_result = _fuzzy_match_travel_type(text)
    if fuzzy_result:
        return fuzzy_result, fuzzy_result == "family"

    # Try AI extraction as final fallback
    ai_result = _ai_extract_params(text)
    ai_type = ai_result.get("traveler_type")
    if ai_type:
        return ai_type, ai_type == "family"

    return "", False


def _extract_travel_style(text: str, fallback: str = "") -> str:
    lowered = text.lower()
    for style, keywords in STYLE_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return style

    # Try fuzzy matching for typos
    fuzzy_result = _fuzzy_match_travel_style(text)
    if fuzzy_result:
        return fuzzy_result

    # Try AI extraction as final fallback
    ai_result = _ai_extract_params(text)
    ai_style = ai_result.get("travel_style")
    if ai_style:
        return ai_style

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

def _extract_hotel_dates(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract check-in and check-out dates from user message.
    Returns (checkin, checkout) as YYYY-MM-DD strings, or (None, None) if not found.
    """
    lowered = text.lower()

    # Pattern 1: Explicit ISO dates (2025-06-01 to 2025-06-05)
    date_match = re.search(
        r"(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    if date_match:
        return date_match.group(1), date_match.group(2)

    # Pattern 2: Relative dates (next Friday, tomorrow, etc.)
    # For simplicity, we'll return None for these - LLM can handle relative references
    # A more advanced implementation could use dateparser library

    # Pattern 3: Duration-based (5 days, 3 nights) - infer from context
    duration_match = re.search(r"(\d{1,2})\s*(day|days|night|nights)\b", lowered)
    if duration_match:
        days = int(duration_match.group(1))
        # Default to today + 1 for checkin, then + days for checkout
        # In production, you'd want to use actual dates
        from datetime import timedelta
        today = date.today()
        checkin = today + timedelta(days=1)
        checkout = checkin + timedelta(days=days)
        return checkin.isoformat(), checkout.isoformat()

    return None, None


def _extract_hotel_budget(text: str, total_budget: Optional[int] = None, duration_days: Optional[int] = None) -> Optional[float]:
    """
    Extract hotel budget per night from user message.

    Budget logic:
    - If user says "$1000 for 5 days" → daily budget = $200
    - Hotel budget should be ~40-60% of daily budget
    - So budget_per_night = daily_budget * 0.5 ( midpoint)
    """
    # First try to extract explicit hotel budget
    hotel_budget_match = re.search(
        r"(hotel|accommodation|stay|sleep)[^0-9]{0,20}(\$?\s*(\d{2,4}))",
        text.lower(),
        flags=re.IGNORECASE,
    )
    if hotel_budget_match:
        return float(hotel_budget_match.group(3))

    # Use total budget and duration if provided
    if total_budget and duration_days:
        daily_budget = total_budget / duration_days
        # Hotel should be ~50% of daily budget (leave room for food, activities)
        return daily_budget * 0.5

    # Extract from general budget mention
    budget = _extract_budget(text)
    if budget:
        # Assume it's total budget, need duration to calculate per-night
        # Default to 3 days if not specified
        days = duration_days or 3
        daily = budget / days
        return daily * 0.5

    return None


def _extract_hotel_travel_style(text: str, fallback: str = "") -> str:
    """
    Extract travel style specifically for hotel search.
    Maps user preferences to hotel location/amenity preferences.
    """
    lowered = text.lower()
    for style, keywords in HOTEL_STYLE_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return style
    return fallback


def extract_hotel_search_params(
    user_message: str,
    user_profile: Optional[dict] = None,
    chat_history: Optional[list] = None,
    fallback_city: str = "",
    fallback_budget: Optional[float] = None,
    fallback_duration: Optional[int] = None,
) -> HotelSearchParams:
    """
    Extract hotel search parameters from user message + profile context.

    Returns HotelSearchParams with:
    - city: destination city from message or trip context
    - checkin: parse from message ("next Friday", "June 5", etc.)
    - checkout: parse end date or checkin + duration
    - budget_per_night: total_budget / trip_days * 0.5
    - adults: number of adults, default 1
    - children: 0 unless user mentioned kids
    - travel_style: from user profile or message keywords

    Returns None for any field that cannot be determined.
    """
    # Extract destination city
    city = _extract_destination(user_message, fallback_city=fallback_city)

    # Extract dates
    checkin, checkout = _extract_hotel_dates(user_message)

    # Extract budget
    total_budget = _extract_budget(user_message) or fallback_budget
    duration_days = _extract_duration_days(user_message) or fallback_duration
    budget_per_night = _extract_hotel_budget(user_message, total_budget, duration_days)

    # Extract travelers
    travelers = _extract_travelers(user_message)
    adults = travelers if travelers else 1
    _, has_kids = _extract_traveler_type(user_message)
    children = 0
    if has_kids:
        # Count kids from message
        child_mentions = len(re.findall(r"(\d+)-year-old|kids|children|child|toddler|teen", user_message.lower()))
        children = max(1, child_mentions) if child_mentions else 1

    # Extract travel style
    travel_style = _extract_hotel_travel_style(user_message)
    if not travel_style and user_profile:
        travel_style = user_profile.get("travel_style", "")

    return HotelSearchParams(
        city=city or None,
        checkin=checkin,
        checkout=checkout,
        budget_per_night=budget_per_night,
        adults=adults,
        children=children,
        travel_style=travel_style or None,
    )


def _extract_hotel_preference(text: str) -> tuple[bool, bool]:
    """
    Extract if user needs hotel and if they explicitly requested it.
    Returns (needs_hotel, hotel_requested) tuple.
    """
    lowered = text.lower()

    # User explicitly says they DON'T need hotel
    no_hotel_phrases = [
        "i have a place", "i have place", "staying with friends", "staying with family",
        "already have accommodation", "got accommodation", "no hotel needed",
        "don't need hotel", "dont need hotel", "no need hotel", "not looking for hotel",
        "have accommodation", "have a place to stay", "place to stay"
    ]
    for phrase in no_hotel_phrases:
        if phrase in lowered:
            return False, False

    # User explicitly ASKS for hotel
    hotel_phrases = [
        "hotel", "accommodation", "place to stay", "where to stay", "need a hotel",
        "looking for hotel", "find hotel", "book hotel", "stay at"
    ]
    for phrase in hotel_phrases:
        if phrase in lowered:
            return True, True

    # Try AI extraction
    ai_result = _ai_extract_params(text)
    ai_needs_hotel = ai_result.get("needs_hotel")
    if ai_needs_hotel is not None:
        return bool(ai_needs_hotel), bool(ai_needs_hotel)

    # Default: needs hotel but hasn't explicitly requested yet
    return True, False


def collect_trip_requirements(
    *,
    text: str,
    fallback_city: str = "",
    fallback_style: str = "",
    fallback_citizenship: str = "",
) -> TripRequirements:
    traveler_type, has_kids = _extract_traveler_type(text)
    start_date, end_date = _extract_date_range(text)
    needs_hotel, hotel_requested = _extract_hotel_preference(text)

    # If date range not found, try AI extraction
    if not start_date and not end_date:
        ai_result = _ai_extract_params(text)
        if not start_date:
            start_date = ai_result.get("start_date")
        if not end_date:
            end_date = ai_result.get("end_date")

    return TripRequirements(
        destination=_extract_destination(text, fallback_city=fallback_city),
        budget_total=_extract_budget(text),
        duration_days=_extract_duration_days(text),
        start_date=start_date,
        end_date=end_date,
        travelers=_extract_travelers(text),
        traveler_type=traveler_type,
        travel_style=_extract_travel_style(text, fallback=fallback_style),
        has_kids=has_kids,
        kids_age_band=_extract_kids_age_band(text),
        citizenship=_extract_citizenship(text, fallback=fallback_citizenship),
        needs_hotel=needs_hotel,
        hotel_requested=hotel_requested,
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
    if requirements.needs_hotel and not requirements.hotel_requested:
        missing.append("hotel")
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


def _norm_key(value: str | None) -> str:
    return (value or "").strip().lower()


def trip_plan_should_refresh(
    thread,
    requirements: TripRequirements,
    user_message: str,
) -> bool:
    """True when the conversation implies the structured trip should be rebuilt."""
    lowered = user_message.lower()
    if any(
        kw in lowered
        for kw in ("regenerate", "rebuild", "update trip", "new trip", "refresh trip")
    ):
        return True
    plan = thread.plan_json or {}
    if not plan:
        return True
    if bool(plan.get("has_kids")) != bool(requirements.has_kids):
        return True
    if requirements.has_kids and plan.get("kids_age_band") and requirements.kids_age_band:
        if _norm_key(requirements.kids_age_band) != _norm_key(str(plan.get("kids_age_band"))):
            return True
    if requirements.destination and _norm_key(requirements.destination) != _norm_key(
        str(plan.get("city") or "")
    ):
        return True
    if requirements.travelers is not None and plan.get("travelers") is not None:
        if int(requirements.travelers) != int(plan["travelers"]):
            return True
    if requirements.duration_days is not None:
        prev = plan.get("duration_days")
        if prev is None:
            prev = plan.get("days_requested")
        if prev is not None and int(requirements.duration_days) != int(prev):
            return True
    if requirements.budget_total is not None and plan.get("budget_total") is not None:
        if int(requirements.budget_total) != int(plan["budget_total"]):
            return True
    if requirements.travel_style and plan.get("travel_style"):
        if _norm_key(requirements.travel_style) != _norm_key(str(plan.get("travel_style"))):
            return True
    if requirements.traveler_type and plan.get("traveler_type"):
        if _norm_key(requirements.traveler_type) != _norm_key(str(plan.get("traveler_type"))):
            return True
    return False


def strip_trip_sources_from_markdown(full_markdown: str) -> str:
    """Remove the Sources section for chat; keep safety and the rest (sources stay on FinalTrip)."""
    marker_sources = "## 📚 Sources"
    marker_safety = "## ⚠️ Safety"
    if marker_sources not in full_markdown:
        return full_markdown
    head, tail = full_markdown.split(marker_sources, 1)
    head = head.rstrip()
    if marker_safety in tail:
        _, after_safety = tail.split(marker_safety, 1)
        return f"{head}\n\n{marker_safety}{after_safety}".strip()
    return head.strip()


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


def generate_auto_title(city: str, travelers: Optional[int] = None, traveler_type: str = "") -> str:
    """
    Generate an auto title for chat threads based on city and travelers.
    Format: city_travelers (e.g., "Paris_2people", "Rome_couple", "Tokyo_solo")
    """
    if not city:
        return "New chat"

    # Normalize city name (capitalize first letter of each word)
    city_formatted = city.strip().title()

    # Determine travelers label
    if travelers == 1 or traveler_type == "solo":
        travelers_label = "solo"
    elif travelers == 2 or traveler_type == "couple":
        travelers_label = "couple"
    elif travelers is not None and travelers > 2:
        travelers_label = f"{travelers}people"
    elif traveler_type == "family":
        travelers_label = "family"
    elif traveler_type == "group":
        travelers_label = "group"
    else:
        travelers_label = "trip"

    return f"{city_formatted}_{travelers_label}"


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


def _trip_summary_lines(plan: Dict[str, object]) -> List[str]:
    out: List[str] = []
    travelers = plan.get("travelers")
    if travelers is not None:
        out.append(f"- **Travelers:** {travelers}")
    dur = plan.get("duration_days")
    if dur is None:
        dur = plan.get("days_requested")
    if dur is not None:
        out.append(f"- **Trip length:** {dur} day(s)")
    start, end = plan.get("start_date"), plan.get("end_date")
    if start and end:
        out.append(f"- **Dates:** {start} → {end}")
    elif start:
        out.append(f"- **Start date:** {start}")
    elif end:
        out.append(f"- **End date:** {end}")
    else:
        out.append("- **Dates:** (set start/end on the chat if you have fixed dates)")

    bt = plan.get("budget_total")
    dbpp = plan.get("daily_budget_per_person")
    daily_b = plan.get("daily_budget")
    if bt is not None:
        line = f"- **Budget:** ${int(bt)} total"
        if dbpp is not None:
            line += f" (~${int(dbpp)}/person/day)"
        out.append(line)
    elif daily_b is not None:
        try:
            out.append(f"- **Daily budget (estimate):** ${int(daily_b)}/person/day")
        except (TypeError, ValueError):
            out.append("- **Budget:** not specified")
    else:
        pl = plan.get("budget")
        if pl is not None:
            out.append(
                f"- **Budget filter:** Google price level ≤ {pl} (planner constraint on places)"
            )
        else:
            out.append("- **Budget:** not specified")

    style = plan.get("travel_style") or ""
    ttype = plan.get("traveler_type") or plan.get("trip_type") or ""
    if style or ttype:
        out.append(
            "- **Trip profile:** "
            + ", ".join(part for part in (ttype, style) if part)
        )
    return out


def _format_trip_response(plan: Dict[str, object]) -> str:
    lines = []
    history_line = plan.get("history_line")
    if history_line:
        lines.append(f"{history_line} I've shaped this trip around it.")
        lines.append("")

    lines.append(f"## Final Trip for {plan.get('city')}")
    lines.append("")
    lines.append("### Trip summary")
    for row in _trip_summary_lines(plan):
        lines.append(row)
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

        # Add lunch recommendation
        lunch = day.get("lunch")
        if lunch:
            lines.append("")
            lines.append(f"🍽️ **Lunch:** [{lunch['name']}]({lunch.get('website') or '#'}) — {lunch.get('address', lunch['category'])}")
            if lunch.get('rating'):
                lines.append(f"   Rating: {lunch['rating']} ⭐ | Price: {lunch.get('price_level', 'N/A')}")

        # Add dinner recommendation
        dinner = day.get("dinner")
        if dinner:
            lines.append(f"🍽️ **Dinner:** [{dinner['name']}]({dinner.get('website') or '#'}) — {dinner.get('address', dinner['category'])}")
            if dinner.get('rating'):
                lines.append(f"   Rating: {dinner['rating']} ⭐ | Price: {dinner.get('price_level', 'N/A')}")

        # Add events for the day
        day_events = day.get("events", [])
        if day_events:
            lines.append("")
            lines.append("🎭 **Events Today:**")
            for event in day_events:
                event_name = event.get("name", "Unknown Event")
                event_url = event.get("web_url") or event.get("url", "#")
                event_date = event.get("date") or event.get("start_date", "")
                # Venue can be a string or a dict with 'name' key
                venue = event.get("venue", "")
                event_venue = venue.get("name", "") if isinstance(venue, dict) else venue
                lines.append(f"- [{event_name}]({event_url}) at {event_venue} {event_date}")

        lines.append("")

    # Add hotel recommendations section
    hotels = plan.get("hotels", [])
    if hotels:
        lines.append("## 🏨 Hotel Recommendations")
        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
        for hotel in hotels[:5]:
            hotel_name = hotel.get("name", "Unknown Hotel")
            hotel_url = hotel.get("booking_url", "#")
            price = hotel.get("price_per_night", 0)
            rating = hotel.get("rating", 0)
            distance = hotel.get("distance_to_center_km", 0)
            hotel_class = hotel.get("hotel_class", 0)
            highlights = hotel.get("highlights", [])

            stars = "⭐" * hotel_class if hotel_class else ""
            lines.append(f"### [{hotel_name}]({hotel_url}) {stars}")
            lines.append(f"- **Price:** ${price}/night")
            lines.append(f"- **Rating:** {rating}/10 ({hotel.get('review_count', 0)} reviews)")
            lines.append(f"- **Distance to center:** {distance} km")
            if highlights:
                lines.append(f"- **Highlights:** {', '.join(highlights[:5])}")
            lines.append("")

    country = plan.get("country") or _country_for_destination(str(plan.get("city") or ""))
    citizenship = ""
    sources = plan.get("sources")
    if not sources:
        sources = _build_sources(plan, country, citizenship)
    items = sources.get("items") or []

    lines.append("## 📚 Sources & Useful Links")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    for item in items:
        lines.append(f"📍 [{item['label']}]({item['url']}) — {item['provider']}")

    visa = sources["visa"]
    if visa["status"] == "required":
        lines.append(f"🛂 {visa['label']} → [link]({visa['url']})")
    elif visa["status"] == "not_required":
        lines.append(f"✅ {visa['label']}")
    elif visa["url"]:
        lines.append(f"🛂 {visa['label']} → [link]({visa['url']})")
    else:
        lines.append(f"🛂 {visa['label']}")
    lines.append(
        f"📋 [{sources['advisory']['label']}]({sources['advisory']['url']})"
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


def enrich_thread_plan_for_final_trip(
    *, user, thread, plan: Dict[str, object]
) -> Dict[str, object]:
    """Turn a raw `build_trip_plan` dict into a full payload for FinalTrip + markdown."""
    city = plan.get("city") or thread.city or ""
    country = _country_for_destination(city)
    days = int(plan.get("days_requested") or plan.get("days_generated") or 1)
    travelers = plan.get("travelers")
    if travelers is None and thread.plan_json:
        travelers = thread.plan_json.get("travelers")
    travelers = travelers or 1

    merged: Dict[str, object] = {**plan}
    merged["country"] = country
    merged["travelers"] = travelers
    merged["duration_days"] = days
    merged["trip_length"] = days
    merged["travel_style"] = merged.get("travel_style") or ""
    merged["traveler_type"] = merged.get("traveler_type") or ""
    merged["family_note"] = (
        "Family-friendly filters applied ✅" if merged.get("has_kids") else ""
    )

    prev = thread.plan_json or {}
    merged["budget_total"] = prev.get("budget_total")
    merged["daily_budget_per_person"] = prev.get("daily_budget_per_person")

    if thread.start_date:
        merged["start_date"] = thread.start_date.isoformat()
    if thread.end_date:
        merged["end_date"] = thread.end_date.isoformat()

    for index, day in enumerate(merged.get("itinerary", [])):
        if isinstance(day, dict):
            day["color"] = DAY_COLORS[index % len(DAY_COLORS)]
            day["color_emoji"] = DAY_EMOJIS[index % len(DAY_EMOJIS)]

    citizenship = ""
    prefs = getattr(user, "preferences", None)
    if prefs:
        citizenship = prefs.citizenship or ""

    merged["route"] = _build_route(merged)
    merged["safety_tips"] = _safety_tips(city, country, bool(merged.get("has_kids")))
    merged["sources"] = _build_sources(merged, country, citizenship)
    merged["needs_citizenship"] = (
        merged["sources"]["visa"]["status"] == "citizenship_needed"
    )
    merged["partial_note"] = ""
    merged["history_line"] = None
    merged["response_markdown"] = _format_trip_response(merged)
    return merged


def generate_trip_payload(
    *, user, requirements: TripRequirements, thread=None
) -> Dict[str, object]:
    days = requirements.duration_days or 3
    price_level_budget = _budget_to_price_level(requirements.budget_total, days)
    pace = "slow" if requirements.has_kids else "medium"
    country = _country_for_destination(requirements.destination)

    history_line = _format_history_line(user)

    # Determine dates for trip planner
    start_date = requirements.start_date
    end_date = requirements.end_date
    if thread:
        start_date = start_date or (thread.start_date.isoformat() if thread.start_date else None)
        end_date = end_date or (thread.end_date.isoformat() if thread.end_date else None)

    # Include hotels if requested or needed
    include_hotels = requirements.hotel_requested or requirements.needs_hotel

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
        start_date=start_date,
        end_date=end_date,
        include_hotels=include_hotels,
        checkin=start_date,
        checkout=end_date,
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
            start_date=start_date,
            end_date=end_date,
            include_hotels=include_hotels,
            checkin=start_date,
            checkout=end_date,
        )
        if retry_plan["days_generated"] >= plan["days_generated"]:
            plan = retry_plan
        if plan["days_generated"] < days:
            partial_note = (
                f"I could only confirm {plan['days_generated']} day(s) from the cached place data, "
                "so I'm sharing the strongest partial route for now."
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
        "trip_length": days,
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
    payload["budget_total"] = requirements.budget_total

    daily_budget_per_person = None
    if requirements.budget_total is not None and days and requirements.travelers:
        try:
            daily_budget_per_person = int(round(requirements.budget_total / days / requirements.travelers))
        except Exception:
            daily_budget_per_person = None
    payload["daily_budget_per_person"] = daily_budget_per_person

    payload["trip_type"] = requirements.traveler_type or requirements.travel_style or ""

    if thread is not None:
        if thread.start_date:
            payload["start_date"] = thread.start_date.isoformat()
        if thread.end_date:
            payload["end_date"] = thread.end_date.isoformat()
    payload["response_markdown"] = _format_trip_response(payload)
    return payload
