from django.contrib import admin
from django.contrib.auth import get_user_model

User = get_user_model()


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "subscription_status", "tokens", "is_active", "is_staff", "date_joined")
    search_fields = ("email",)
    list_filter = ("role", "subscription_status", "is_active", "is_staff", "date_joined")
    readonly_fields = ("date_joined",)
    ordering = ("-date_joined",)
    list_per_page = 20
    list_max_show_all = 100
    list_editable = ("role", "subscription_status", "is_active", "is_staff")
