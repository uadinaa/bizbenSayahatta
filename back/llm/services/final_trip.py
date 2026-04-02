from __future__ import annotations

from typing import Any, Dict

from llm.models import FinalTrip


def sync_final_trip(thread, payload: Dict[str, Any] | None):
    # Persist the normalized final trip for a single chat thread.
    if not payload:
        return None

    itinerary = payload.get("itinerary") or []
    route = payload.get("route") or []
    defaults = {
        "city": payload.get("city") or thread.city or "",
        "country": payload.get("country") or "",
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

