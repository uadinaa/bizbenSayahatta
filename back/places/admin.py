from django.contrib import admin

from .models import InterestMapping, Place, SavedPlace, PlaceSearchCache, MustVisitPlace, UserMapPlace


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


@admin.register(MustVisitPlace)
class MustVisitPlaceAdmin(admin.ModelAdmin):
    list_display = ("user", "place", "created_at")
    list_filter = ("created_at",)


@admin.register(UserMapPlace)
class UserMapPlaceAdmin(admin.ModelAdmin):
    list_display = ("user", "city", "country", "date", "created_at")
    list_filter = ("country", "created_at")
    search_fields = ("city", "country", "user__email")
