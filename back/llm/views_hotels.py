"""
Hotels API Views

Exposes endpoints for searching hotels via Booking.com RapidAPI.
"""

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .services.hotel_cache import get_hotels_cached, is_hotel_cached


class HotelSearchView(APIView):
    """
    GET /api/hotels/search/

    Search hotels with caching.
    Query params: city, checkin, checkout, budget_per_night, adults, children, travel_style

    Returns:
    {
        "hotels": [...normalized hotel list...],
        "cached": true/false,
        "city": "Paris",
        "filters_applied": {
            "price_max": 120,
            "travel_style": "active"
        }
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Extract query params
        city = request.query_params.get("city", "").strip()
        checkin = request.query_params.get("checkin", "").strip()
        checkout = request.query_params.get("checkout", "").strip()
        budget_per_night = request.query_params.get("budget_per_night")
        adults = request.query_params.get("adults", "1")
        children = request.query_params.get("children", "0")
        travel_style = request.query_params.get("travel_style", "")

        # Validate required params
        missing_params = []
        if not city:
            missing_params.append("city")
        if not checkin:
            missing_params.append("checkin")
        if not checkout:
            missing_params.append("checkout")

        if missing_params:
            return Response(
                {
                    "error": "Missing required parameters",
                    "missing": missing_params,
                    "message": f"Please provide: {', '.join(missing_params)}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate dates format (YYYY-MM-DD)
        import re
        date_pattern = r"^\d{4}-\d{2}-\d{2}$"
        if not re.match(date_pattern, checkin):
            return Response(
                {"error": "Invalid checkin date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not re.match(date_pattern, checkout):
            return Response(
                {"error": "Invalid checkout date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse numeric params
        try:
            budget = float(budget_per_night) if budget_per_night else 100.0
            adults_num = int(adults)
            children_num = int(children)
        except (ValueError, TypeError) as exc:
            return Response(
                {"error": f"Invalid numeric parameter: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if cached before fetching
        was_cached = is_hotel_cached(city, checkin, checkout, budget, adults_num)

        # Fetch hotels (uses cache internally)
        hotels = get_hotels_cached(
            city_name=city,
            checkin=checkin,
            checkout=checkout,
            budget_per_night=budget,
            adults=adults_num,
            children=children_num,
            travel_style=travel_style or None,
        )

        # Build response
        price_max = int(budget * 0.9)
        response_data = {
            "hotels": hotels,
            "cached": was_cached,
            "city": city,
            "checkin": checkin,
            "checkout": checkout,
            "filters_applied": {
                "price_max": price_max,
                "price_min": int(budget * 0.4),
                "travel_style": travel_style or "default",
                "adults": adults_num,
                "children": children_num,
            },
        }

        return Response(response_data, status=status.HTTP_200_OK)
