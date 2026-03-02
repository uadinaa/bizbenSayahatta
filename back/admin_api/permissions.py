from rest_framework import permissions
from rest_framework.exceptions import NotAuthenticated, PermissionDenied


class IsAdminUser(permissions.BasePermission):
    """
    Allow access only to authenticated staff users.
    - Unauthenticated requests -> 401 Unauthorized (raise NotAuthenticated).
    - Authenticated but not staff -> 403 Forbidden (raise PermissionDenied).
    """

    message = "You do not have permission to perform this action (admin only)."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            raise NotAuthenticated(detail="Authentication credentials were not provided.")
        if not (request.user.is_staff or getattr(request.user, "role", None) == "ADMIN"):
            raise PermissionDenied(detail=self.message)
        return True
