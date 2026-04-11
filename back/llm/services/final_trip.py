from __future__ import annotations

from datetime import date
from typing import Any, Dict

from llm.models import FinalTrip


def _normalize_trip_type(value: Any) -> str | None:
    raw = (str(value).strip().lower() if value is not None else "")
    if not raw:
        return None
    mapping = {
        "culture": "cultural",
        "cultural": "cultural",
        "adventure": "adventure",
        "relax": "relaxation",
        "relaxed": "relaxation",
        "relaxation": "relaxation",
        "food": "food",
        "foodie": "food",
        "mix": "mix",
        "mixed": "mix",
        "family": "family",
        "solo": "solo",
        "couple": "couple",
        "group": "group",
    }
    return mapping.get(raw, raw)


def _to_int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _coerce_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None
    return None


def sync_final_trip(thread, payload: Dict[str, Any] | None):
    # Persist the normalized final trip for a single chat thread.
    if not payload:
        return None

    itinerary = payload.get("itinerary") or []
    route = payload.get("route") or []
    travelers = _to_int_or_none(payload.get("travelers"))
    daily_budget = _to_int_or_none(
        payload.get("daily_budget")
        if payload.get("daily_budget") is not None
        else payload.get("daily_budget_per_person")
    )
    trip_type = _normalize_trip_type(
        payload.get("trip_type")
        or payload.get("traveler_type")
        or payload.get("travel_style")
    )
    start_date = _coerce_date(payload.get("start_date")) or thread.start_date
    end_date = _coerce_date(payload.get("end_date")) or thread.end_date
    safety_tips = payload.get("safety_tips")
    if safety_tips is None:
        safety_tips = []
    sources = payload.get("sources")
    if sources is None:
        sources = {}

    defaults = {
        "city": payload.get("city") or thread.city or "",
        "country": payload.get("country") or "",
        "trip_type": trip_type,
        "travelers": travelers,
        "daily_budget": daily_budget,
        "start_date": start_date,
        "end_date": end_date,
        "safety_tips": safety_tips,
        "sources": sources,
        "itinerary": itinerary,
        "route": route,
        "plan_snapshot": payload,
        "response_markdown": payload.get("response_markdown", ""),
    }
    final_trip, _ = FinalTrip.objects.update_or_create(
        thread=thread,
        defaults=defaults,
    )
    return final_trip