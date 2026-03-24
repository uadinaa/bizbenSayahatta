from __future__ import annotations

import logging

import requests


logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "bizben-sayahat/1.0"


def geocode_place(place_name: str, city: str = "", country: str = ""):
    query_parts = [value for value in [place_name, city, country] if value]
    query = ", ".join(query_parts)
    params = {
        "q": query,
        "format": "json",
        "limit": 1,
    }
    headers = {
        "User-Agent": NOMINATIM_USER_AGENT,
    }

    try:
        response = requests.get(
            NOMINATIM_URL,
            params=params,
            headers=headers,
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
        if data:
            return {
                "lat": float(data[0]["lat"]),
                "lng": float(data[0]["lon"]),
                "name": place_name,
            }
        return None
    except Exception as exc:
        logger.warning("Nominatim error for '%s': %s", query, exc)
        return None
