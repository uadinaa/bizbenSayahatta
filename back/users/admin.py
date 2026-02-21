from django.contrib import admin
from django.contrib.auth import get_user_model
from django_extensions.admin import ForeignKeyAutocompleteAdmin
from .models import UserPreferences

# Register your models here.
User = get_user_model()

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_active', 'is_staff', 'date_joined')
    search_fields = ('email',)
    list_filter = ('is_active', 'is_staff', 'date_joined')
    readonly_fields = ('date_joined',)
    ordering = ('-date_joined',)
    list_per_page = 20
    list_max_show_all = 100
    list_editable = ('is_active', 'is_staff')


