from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from places.serializers import PlaceSerializer
from places.services.google_places import get_places
from rest_framework.generics import ListAPIView
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from places.models import Place
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from places.services.save_place import save_place_for_user
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, filters

class PlaceFilter(FilterSet):
    category = filters.CharFilter(field_name="category", lookup_expr='iexact')
    status = filters.CharFilter(field_name="status", lookup_expr='iexact')

    class Meta:
        model = Place
        fields = ["category", "status"]


class InspirationListAPIView(ListAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["category", "status"]
    ordering_fields = ["rating", "saves_count"]
    ordering = ["-rating"]


class PlacesListAPIView(APIView):
    def get(self, request):
        city = request.query_params.get("city")
        category = request.query_params.get("category")

        if not city or not category:
            return Response(
                {"detail": "city and category are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        places = get_places(city, category)
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
