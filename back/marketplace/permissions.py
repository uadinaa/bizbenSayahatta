from rest_framework import permissions


class HasAnyRole(permissions.BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role in self.allowed_roles:
            return True
        if "ADMIN" in self.allowed_roles and user.is_staff:
            return True
        return False


class IsAdminRole(HasAnyRole):
    allowed_roles = ("ADMIN",)


class IsManagerRole(HasAnyRole):
    allowed_roles = ("MANAGER", "ADMIN")


class IsTripAdvisorRole(HasAnyRole):
    allowed_roles = ("TRIPADVISOR", "ADMIN")
