from django.contrib import admin

from .models import InterestMapping, Place, SavedPlace, PlaceSearchCache, VisitedPlace


@admin.register(InterestMapping)
class InterestMappingAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "category", "rating", "is_must_visit")
    search_fields = ("name", "city", "category")
    list_filter = ("city", "category", "status", "is_must_visit")


@admin.register(SavedPlace)
class SavedPlaceAdmin(admin.ModelAdmin):
    list_display = ("user", "place", "created_at")


@admin.register(PlaceSearchCache)
class PlaceSearchCacheAdmin(admin.ModelAdmin):
    list_display = ("city", "category", "last_fetched")

@admin.register(VisitedPlace)
class VisitedPlaceAdmin(admin.ModelAdmin):
    list_display = ("user", "place", "created_at")
    search_fields = ("user__email", "place__name")