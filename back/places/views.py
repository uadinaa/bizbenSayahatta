from django_filters.rest_framework import DjangoFilterBackend, FilterSet, filters
from rest_framework import status
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from places.models import Place, VisitedPlace, SavedPlace, MustVisitPlace, UserMapPlace
from places.serializers import (
    PlaceSerializer,
    PlaceMapSerializer,
    UserMapPlaceSerializer,
    VisitedPlaceSerializer,
)
from places.services.google_places import get_places
from places.services.save_place import save_place_for_user
from users.permissions import IsActiveAndNotBlocked

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
                must_visit_place_ids = MustVisitPlace.objects.filter(
                    user=self.request.user
                ).values_list("place_id", flat=True)
                if wants_must_visit:
                    queryset = queryset.filter(id__in=must_visit_place_ids)
                else:
                    queryset = queryset.exclude(id__in=must_visit_place_ids)
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
        save_place_for_user(
            user=request.user,
            place_id=place_id,
        )
        return Response(
            {"detail": "Place saved"},
            status=status.HTTP_201_CREATED
        )


class WishlistAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        category = request.query_params.get("category")
        places = (
            Place.objects.filter(saved_by__user=request.user)
            .order_by("-saved_by__created_at")
            .distinct()
        )
        if category and category.lower() != "all":
            places = places.filter(category__iexact=category)
        serializer = PlaceMapSerializer(places, many=True, context={"request": request})
        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class VisitPlaceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def post(self, request, place_id):
        place = Place.objects.get(id=place_id)
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
        place = Place.objects.get(id=place_id)

        if "is_must_visit" in request.data:
            next_value = bool(request.data.get("is_must_visit"))
        else:
            next_value = not MustVisitPlace.objects.filter(
                user=request.user,
                place=place,
            ).exists()

        if next_value:
            MustVisitPlace.objects.get_or_create(user=request.user, place=place)
        else:
            MustVisitPlace.objects.filter(user=request.user, place=place).delete()

        return Response(
            {"id": place.id, "is_must_visit": next_value},
            status=status.HTTP_200_OK,
        )


class UserMapPlaceListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def get(self, request):
        places = UserMapPlace.objects.filter(user=request.user)
        serializer = UserMapPlaceSerializer(places, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserMapPlaceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        place = serializer.save(user=request.user)
        return Response(UserMapPlaceSerializer(place).data, status=status.HTTP_201_CREATED)


class UserMapPlaceDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAndNotBlocked]

    def delete(self, request, place_id):
        place = UserMapPlace.objects.filter(id=place_id, user=request.user).first()
        if not place:
            return Response({"detail": "Map place not found"}, status=status.HTTP_404_NOT_FOUND)
        place.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
