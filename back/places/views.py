import secrets

from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404, render
from django.views import View
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, filters
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model
from users.models import UserPreferences

from places.models import Place, VisitedPlace, SavedPlace, MustVisitPlace, UserMapPlace
from places.serializers import (
    PlaceSerializer,
    PlaceMapSerializer,
    UserMapPlaceSerializer,
    VisitedPlaceSerializer,
    PublicUserMapPlaceSerializer,
    PublicVisitedPlaceSerializer,
    PublicMapUserListSerializer,
)
from places.services.google_places import get_places
from places.services.save_place import save_place_for_user, set_place_wishlist_state
from places.services.tripadvisor_service import get_tours_cached
from bizbenSayahatta.api_exceptions import MapPlaceAlreadyExistsError
from users.permissions import IsActiveAndNotBlocked

from llm.services.hotel_cache import get_hotels_cached, is_hotel_cached

BADGE_LEVELS = [
    {"code": "starter", "label": "Starter", "threshold": 1},
    {"code": "explorer", "label": "Explorer", "threshold": 5},
    {"code": "adventurer", "label": "Adventurer", "threshold": 10},
    {"code": "globetrotter", "label": "Globetrotter", "threshold": 20},
]


def _get_badges(visited_count):
    return [
        {
            "code": badge["code"],
            "label": badge["label"],
            "threshold": badge["threshold"],
        }
        for badge in BADGE_LEVELS
        if visited_count >= badge["threshold"]
    ]


def _share_token_from_request(request):
    return request.query_params.get("share_token") or request.query_params.get("token")


def _travel_map_url_access(request, target_user):
    """Public or unlisted access: public profile flag or valid share_token query param."""
    if getattr(target_user, "is_map_public", False):
        return True
    return _valid_share_token_request(request, target_user)


def _valid_share_token_request(request, target_user):
    token = _share_token_from_request(request)
    secret = getattr(target_user, "map_share_token", None) or ""
    if not token or not secret:
        return False
    return secrets.compare_digest(str(secret), str(token))


def _iter_map_markers_for_user(target, include_map_pins, include_visited_pins):
    """Yield dicts with lat, lng, name, country (efficient column-only queries)."""
    if include_map_pins:
        qs = UserMapPlace.objects.filter(user=target).values("lat", "lon", "city", "country")
        for row in qs.iterator(chunk_size=512):
            city = (row.get("city") or "").strip()
            country = (row.get("country") or "").strip()
            label = city or country or "—"
            yield {
                "lat": row["lat"],
                "lng": row["lon"],
                "name": label,
                "country": country,
            }
    if include_visited_pins:
        qs = (
            VisitedPlace.objects.filter(user=target)
            .values("place__lat", "place__lng", "place__name", "place__country")
        )
        for row in qs.iterator(chunk_size=512):
            lat, lng = row.get("place__lat"), row.get("place__lng")
            if lat is None or lng is None:
                continue
            yield {
                "lat": lat,
                "lng": lng,
                "name": (row.get("place__name") or "").strip() or "—",
                "country": (row.get("place__country") or "").strip(),
            }


class PlaceFilter(FilterSet):
    category = filters.CharFilter(field_name="category", lookup_expr='iexact')
    status = filters.CharFilter(field_name="status", lookup_expr='iexact')
    is_must_visit = filters.BooleanFilter(field_name="is_must_visit")

    class Meta:
        model = Place
        fields = ["category", "status", "is_must_visit"]


def _price_level_to_number(price_level):
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


class InspirationListAPIView(ListAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ["category", "status"]
    ordering_fields = ["rating", "saves_count"]
    search_fields = ["name", "city", "country", "category", "address", "neighborhood"]
    ordering = ["-rating"]

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)

        budget = self.request.query_params.get("budget")
        open_now = self.request.query_params.get("open_now")
        is_must_visit = self.request.query_params.get("is_must_visit")

        if is_must_visit is not None:
            wants_must_visit = str(is_must_visit).lower() in {"1", "true", "yes"}
            if self.request.user.is_authenticated:
                favorite_place_ids = set(
                    MustVisitPlace.objects.filter(
                        user=self.request.user
                    ).values_list("place_id", flat=True)
                )
                favorite_place_ids.update(
                    SavedPlace.objects.filter(
                        user=self.request.user
                    ).values_list("place_id", flat=True)
                )
                if wants_must_visit:
                    queryset = queryset.filter(id__in=favorite_place_ids)
                else:
                    queryset = queryset.exclude(id__in=favorite_place_ids)
            elif wants_must_visit:
                queryset = queryset.none()

        places = list(queryset)

        if budget is not None:
            try:
                budget_value = int(budget)
            except ValueError:
                budget_value = None
            if budget_value is not None:
                filtered = []
                for place in places:
                    place_price = _price_level_to_number(place.price_level)
                    if place_price is None or place_price <= budget_value:
                        filtered.append(place)
                places = filtered

        if open_now is not None:
            open_value = str(open_now).lower() in {"1", "true", "yes"}
            places = [
                place
                for place in places
                if place.opening_hours is None
                or place.opening_hours.get("openNow") == open_value
            ]

        return places
    
    def get(self, request, *args, **kwargs):
        """
        Extended to also return TripAdvisor tours alongside Google Places.
        Response format: { "places": [...], "tours": [...] }
        """
        # Get filtered places using the existing filter_queryset logic
        places_queryset = self.filter_queryset(self.get_queryset())

        # Apply pagination
        page = self.paginate_queryset(places_queryset)
        if page is not None:
            places_serializer = self.get_serializer(page, many=True, context={"request": request})
            places_data = places_serializer.data
            response_data = {
                "places": places_data,
                "next": self.paginator.get_next_link(),
                "previous": self.paginator.get_previous_link(),
            }
        else:
            places_serializer = self.get_serializer(places_queryset, many=True, context={"request": request})
            response_data = {
                "places": places_serializer.data,
            }

        # Fetch TripAdvisor tours (with caching)
        # Extract city from search param for tour fetching
        city = request.query_params.get("search") or request.query_params.get("city")
        tours = []
        if city:
            try:
                tours = get_tours_cached(city=city, max_results=10)
            except Exception:
                # Silently fail - don't crash the page if TripAdvisor API is down
                tours = []

        response_data["tours"] = tours

        return Response(response_data)


class PlacesListAPIView(APIView):
    def get(self, request):
        city = request.query_params.get("city")
        category = request.query_params.get("category")
        refresh = request.query_params.get("refresh")
        budget = request.query_params.get("budget")
        open_now = request.query_params.get("open_now")

        if not city or not category:
            return Response(
                {"detail": "city and category are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        force_refresh = str(refresh).lower() in {"1", "true", "yes"}
        places = list(get_places(city, category, force_refresh=force_refresh))

        if budget is not None:
            try:
                budget_value = int(budget)
            except ValueError:
                budget_value = None
            if budget_value is not None:
                filtered = []
                for place in places:
                    place_price = _price_level_to_number(place.price_level)
                    if place_price is None or place_price <= budget_value:
                        filtered.append(place)
                places = filtered

        if open_now is not None:
            open_value = str(open_now).lower() in {"1", "true", "yes"}
            places = [
                place
                for place in places
                if place.opening_hours is None
                or place.opening_hours.get("openNow") == open_value
            ]
        serializer = PlaceSerializer(places, many=True, context={"request": request})

        return Response(serializer.data)


class SavePlaceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, place_id):
        result = set_place_wishlist_state(
            user=request.user,
            place_id=place_id,
            is_favorited=True,
        )
        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class WishlistAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        category = request.query_params.get("category")
        must_visit_entries = list(
            MustVisitPlace.objects.filter(user=request.user)
            .select_related("place")
            .order_by("-created_at")
        )
        saved_entries = list(
            SavedPlace.objects.filter(user=request.user)
            .select_related("place")
            .order_by("-created_at")
        )

        ordered_places = []
        seen_place_ids = set()
        for entry in must_visit_entries + saved_entries:
            place = entry.place
            if place.id in seen_place_ids:
                continue
            seen_place_ids.add(place.id)
            ordered_places.append(place)

        places = ordered_places
        if category and category.lower() != "all":
            places = [place for place in places if place.category.lower() == category.lower()]
        serializer = PlaceMapSerializer(places, many=True, context={"request": request})
        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class VisitPlaceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, place_id):
        place = get_object_or_404(Place, id=place_id)
        VisitedPlace.objects.get_or_create(user=request.user, place=place)
        visited_count = VisitedPlace.objects.filter(user=request.user).count()
        badges = _get_badges(visited_count)
        return Response(
            {
                "detail": "Place marked as visited",
                "visited_count": visited_count,
                "badges": badges,
            },
            status=status.HTTP_201_CREATED,
        )


class UnvisitPlaceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def delete(self, request, place_id):
        visited = VisitedPlace.objects.filter(user=request.user, place_id=place_id).first()
        if not visited:
            return Response({"detail": "Visit record not found."}, status=status.HTTP_404_NOT_FOUND)
        visited.delete()
        visited_count = VisitedPlace.objects.filter(user=request.user).count()
        badges = _get_badges(visited_count)
        return Response(
            {
                "detail": "Place removed from visited.",
                "visited_count": visited_count,
                "badges": badges,
            },
            status=status.HTTP_200_OK,
        )


class VisitedPlacesAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        from django.db.models import F
        from django.db.models.functions import Coalesce

        visited = (
            VisitedPlace.objects.filter(user=request.user)
            .select_related("place")
            .order_by(Coalesce(F("visited_at"), F("created_at")).desc())
        )
        serializer = VisitedPlaceSerializer(visited, many=True, context={"request": request})
        visited_count = visited.count()
        badges = _get_badges(visited_count)
        return Response(
            {
                "count": visited_count,
                "badges": badges,
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class PlaceMustVisitAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, place_id):
        place = get_object_or_404(Place, id=place_id)

        if "is_must_visit" in request.data:
            next_value = bool(request.data.get("is_must_visit"))
        else:
            next_value = not MustVisitPlace.objects.filter(
                user=request.user,
                place=place,
            ).exists()
        result = set_place_wishlist_state(
            user=request.user,
            place_id=place.id,
            is_favorited=next_value,
        )
        return Response(result, status=status.HTTP_200_OK)


class UserMapPlaceListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        places = UserMapPlace.objects.filter(user=request.user)
        serializer = UserMapPlaceSerializer(places, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserMapPlaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        duplicate_exists = UserMapPlace.objects.filter(
            user=request.user,
            city__iexact=serializer.validated_data["city"],
            country__iexact=serializer.validated_data["country"],
            date=serializer.validated_data["date"],
            lat=serializer.validated_data["lat"],
            lon=serializer.validated_data["lon"],
        ).exists()
        if duplicate_exists:
            raise MapPlaceAlreadyExistsError()

        place = serializer.save(user=request.user)
        return Response(UserMapPlaceSerializer(place).data, status=status.HTTP_201_CREATED)


class UserMapPlaceDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def delete(self, request, place_id):
        place = UserMapPlace.objects.filter(id=place_id, user=request.user).first()
        if not place:
            raise NotFound("Map place not found.")
        place.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserPublicMapAPIView(APIView):
    """
    GET /api/places/users/<user_id>/map/
    Returns map places, visited places, and badges for the given user.
    - If requester is the owner: full data (including dates).
    - If requester is another user (or anonymous): only data allowed by target's privacy
      (share_map, share_visited_places, share_badges). No dates or time-related fields.
    Non-owners need either is_map_public on the user or a valid ?share_token= (or ?token=).
    If nothing is shared, returns 403.
    """

    permission_classes = []  # public endpoint; visibility enforced inside

    def get(self, request, user_id):
        User = get_user_model()
        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        is_owner = request.user.is_authenticated and request.user.id == target.id

        if is_owner:
            map_places = UserMapPlace.objects.filter(user=target)
            visited = VisitedPlace.objects.filter(user=target).select_related("place").order_by("-created_at")
            visited_count = visited.count()
            badges = _get_badges(visited_count)
            return Response(
                {
                    "user": {"id": target.id, "username": target.username or target.email},
                    "map_places": UserMapPlaceSerializer(map_places, many=True).data,
                    "visited_places": VisitedPlaceSerializer(visited, many=True, context={"request": request}).data,
                    "badges": badges,
                },
                status=status.HTTP_200_OK,
            )

        if not target.is_active or target.deleted_at is not None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not _travel_map_url_access(request, target):
            return Response(
                {"detail": "This map is private or the link is invalid."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user_summary = PublicMapUserListSerializer(target, context={"request": request}).data

        if _valid_share_token_request(request, target):
            map_places = UserMapPlace.objects.filter(user=target)
            visited = VisitedPlace.objects.filter(user=target).select_related("place")
            visited_count = VisitedPlace.objects.filter(user=target).count()
            return Response(
                {
                    "user": user_summary,
                    "map_places": PublicUserMapPlaceSerializer(map_places, many=True).data,
                    "visited_places": PublicVisitedPlaceSerializer(visited, many=True).data,
                    "badges": _get_badges(visited_count),
                },
                status=status.HTTP_200_OK,
            )

        prefs = UserPreferences.objects.filter(user=target).first()
        if not prefs:
            return Response(
                {"detail": "This user has not shared their travel map."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not (prefs.share_map or prefs.share_visited_places or prefs.share_badges):
            return Response(
                {"detail": "This user has not shared their travel map."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payload = {
            "user": user_summary,
        }
        if prefs.share_map:
            map_places = UserMapPlace.objects.filter(user=target)
            payload["map_places"] = PublicUserMapPlaceSerializer(map_places, many=True).data
        else:
            payload["map_places"] = []
        if prefs.share_visited_places:
            visited = VisitedPlace.objects.filter(user=target).select_related("place")
            payload["visited_places"] = PublicVisitedPlaceSerializer(visited, many=True).data
        else:
            payload["visited_places"] = []
        if prefs.share_badges:
            visited_count = VisitedPlace.objects.filter(user=target).count()
            payload["badges"] = _get_badges(visited_count)
        else:
            payload["badges"] = []

        return Response(payload, status=status.HTTP_200_OK)


class UsersWithPublicMapListAPIView(ListAPIView):
    """
    GET /api/places/users/shared-maps/
    Returns users with a discoverable public map (is_map_public and share_map).
    Public endpoint (no auth required).
    """

    permission_classes = []
    serializer_class = PublicMapUserListSerializer

    def get_queryset(self):
        User = get_user_model()
        return (
            User.objects.filter(
                is_map_public=True,
                preferences__share_map=True,
                is_active=True,
                deleted_at__isnull=True,
            )
            .order_by("username", "id")
            .distinct()
        )


class UserPublicMapMarkersAPIView(APIView):
    """
    GET /api/places/users/<user_id>/map/markers/
    GET /api/places/users/by-username/<username>/map/markers/

    Read-only list optimized for Leaflet: [{"lat","lng","name","country"}, ...].
    Query params: share_token or token (for private maps).
    """

    permission_classes = []

    def _resolve_user(self, user_id=None, username=None):
        User = get_user_model()
        if user_id is not None:
            return User.objects.filter(id=user_id).first()
        uname = (username or "").strip()
        if not uname:
            return None
        return User.objects.filter(username__iexact=uname).first()

    def get(self, request, user_id=None, username=None):
        target = self._resolve_user(user_id=user_id, username=username)
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        is_owner = request.user.is_authenticated and request.user.id == target.id

        if is_owner:
            markers = list(
                _iter_map_markers_for_user(
                    target,
                    include_map_pins=True,
                    include_visited_pins=True,
                )
            )
            return Response(markers, status=status.HTTP_200_OK)

        if not target.is_active or target.deleted_at is not None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not _travel_map_url_access(request, target):
            return Response(
                {"detail": "This map is private or the link is invalid."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Secret link: show the same geographic layers as the owner (map pins + visited places).
        # Public gallery viewers still follow per-field privacy toggles.
        if _valid_share_token_request(request, target):
            markers = list(
                _iter_map_markers_for_user(
                    target,
                    include_map_pins=True,
                    include_visited_pins=True,
                )
            )
            return Response(markers, status=status.HTTP_200_OK)

        prefs = UserPreferences.objects.filter(user=target).first()
        if not prefs or not (prefs.share_map or prefs.share_visited_places or prefs.share_badges):
            return Response(
                {"detail": "This user has not shared their travel map."},
                status=status.HTTP_403_FORBIDDEN,
            )

        markers = list(
            _iter_map_markers_for_user(
                target,
                include_map_pins=bool(prefs.share_map),
                include_visited_pins=bool(prefs.share_visited_places),
            )
        )
        return Response(markers, status=status.HTTP_200_OK)


class TravelMapShareHTMLView(View):
    """
    Server-rendered page with Open Graph tags for messengers; redirects humans to the SPA.
    Path: /share/travel-map/<user_id>/?share_token=...
    """

    def get(self, request, user_id):
        User = get_user_model()
        target = (
            User.objects.filter(
                id=user_id,
                is_active=True,
                deleted_at__isnull=True,
            ).first()
        )
        if not target or not _travel_map_url_access(request, target):
            raise Http404()

        if not _valid_share_token_request(request, target):
            prefs = UserPreferences.objects.filter(user=target).first()
            if not prefs or not (prefs.share_map or prefs.share_visited_places or prefs.share_badges):
                raise Http404()

        display_name = (target.username or "").strip() or (target.email.split("@")[0] if target.email else "Traveler")
        title = f"{display_name} — travel map"
        description = "View visited places on an interactive map."
        frontend = getattr(settings, "FRONTEND_APP_URL", "http://127.0.0.1:5173").rstrip("/")
        q = request.META.get("QUERY_STRING", "")
        path = f"/map/u/{user_id}/"
        redirect_url = f"{frontend}{path}" + (f"?{q}" if q else "")
        og_url = request.build_absolute_uri()
        og_image = f"{frontend}/vite.svg"

        return render(
            request,
            "places/travel_map_share.html",
            {
                "title": title,
                "description": description,
                "og_url": og_url,
                "og_image": og_image,
                "redirect_url": redirect_url,
            },
        )


class HotelsSearchAPIView(APIView):
    """
    GET /api/places/hotels/search/
    Search hotels with caching. Requires authentication.

    Query params:
    - city (required): Destination city
    - checkin (required): Check-in date (YYYY-MM-DD)
    - checkout (required): Checkout date (YYYY-MM-DD)
    - budget_per_night (required): Budget per night in USD
    - adults (optional): Number of adults (default 1)
    - children (optional): Number of children (default 0)
    - travel_style (optional): One of 'active', 'relaxed', 'cultural', 'budget', 'family'

    Returns:
    {
        "hotels": [...],
        "cached": true/false,
        "city": "Paris",
        "filters_applied": {
            "price_max": 120,
            "travel_style": "active"
        }
    }
    """
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        # Get required params
        city = request.query_params.get("city")
        checkin = request.query_params.get("checkin")
        checkout = request.query_params.get("checkout")
        budget_per_night = request.query_params.get("budget_per_night")

        # Validate required params
        missing = []
        if not city:
            missing.append("city")
        if not checkin:
            missing.append("checkin")
        if not checkout:
            missing.append("checkout")
        if not budget_per_night:
            missing.append("budget_per_night")

        if missing:
            return Response(
                {"detail": f"Missing required parameters: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse optional params
        try:
            adults = int(request.query_params.get("adults", 1))
        except (ValueError, TypeError):
            adults = 1

        try:
            children = int(request.query_params.get("children", 0))
        except (ValueError, TypeError):
            children = 0

        try:
            budget_value = float(budget_per_night)
        except (ValueError, TypeError):
            return Response(
                {"detail": "budget_per_night must be a valid number"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        travel_style = request.query_params.get("travel_style")

        # Check if cached before fetching
        was_cached = is_hotel_cached(
            city=city,
            checkin=checkin,
            checkout=checkout,
            budget_per_night=budget_value,
            adults=adults,
        )

        # Fetch hotels (uses cache internally)
        hotels = get_hotels_cached(
            city_name=city,
            checkin=checkin,
            checkout=checkout,
            budget_per_night=budget_value,
            adults=adults,
            children=children,
            travel_style=travel_style,
        )

        # Build filters applied info
        filters_applied = {
            "price_max": int(budget_value * 0.9),
        }
        if travel_style:
            filters_applied["travel_style"] = travel_style

        return Response(
            {
                "hotels": hotels,
                "cached": was_cached,
                "city": city,
                "filters_applied": filters_applied,
            },
            status=status.HTTP_200_OK,
        )
