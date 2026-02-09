from django_filters.rest_framework import DjangoFilterBackend, FilterSet, filters
from rest_framework import status
from rest_framework.filters import OrderingFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from places.models import Place
from places.serializers import PlaceSerializer
from places.services.google_places import get_places
from places.services.save_place import save_place_for_user

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
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["category", "status", "is_must_visit"]
    ordering_fields = ["rating", "saves_count"]
    ordering = ["-rating"]

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)

        budget = self.request.query_params.get("budget")
        open_now = self.request.query_params.get("open_now")

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
        serializer = PlaceSerializer(places, many=True)

        return Response(serializer.data)

class SavePlaceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, place_id):
        save_place_for_user(
            user=request.user,
            place_id=place_id
        )
        return Response(
            {"detail": "Place saved"},
            status=status.HTTP_201_CREATED
        )


class PlaceMustVisitAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, place_id):
        place = Place.objects.get(id=place_id)

        if "is_must_visit" in request.data:
            place.is_must_visit = bool(request.data.get("is_must_visit"))
        else:
            place.is_must_visit = not place.is_must_visit

        place.save(update_fields=["is_must_visit"])

        return Response(
            {"id": place.id, "is_must_visit": place.is_must_visit},
            status=status.HTTP_200_OK,
        )
