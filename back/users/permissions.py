from django.utils import timezone
from rest_framework import permissions


class IsActiveAndNotBlocked(permissions.BasePermission):
    message = "Account is blocked. Contact support."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if not user.is_active:
            return False
        if not getattr(user, "is_blocked", False):
            return True

        expires_at = getattr(user, "block_expires_at", None)
        if expires_at and timezone.now() >= expires_at:
            user.is_blocked = False
            user.block_expires_at = None
            user.is_active = True
            user.save(update_fields=["is_blocked", "block_expires_at", "is_active"])
            return True

        return False
