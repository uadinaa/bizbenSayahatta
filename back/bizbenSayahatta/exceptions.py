import logging
import uuid

from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler


logger = logging.getLogger("bizbenSayahatta.errors")


def _context_extra(context, status_code, error_id=None):
    request = context.get("request")
    user = getattr(request, "user", None) if request else None
    return {
        "request_id": getattr(request, "request_id", None) if request else None,
        "path": getattr(request, "path", None) if request else None,
        "method": getattr(request, "method", None) if request else None,
        "user_id": getattr(user, "id", None) if user else None,
        "role": getattr(user, "role", None) if user else None,
        "status_code": status_code,
        "error_id": error_id,
        "remote_addr": request.META.get("REMOTE_ADDR") if request else None,
    }


def _extract_message(response, fallback):
    data = response.data
    if isinstance(data, dict):
        detail = data.get("detail")
        if isinstance(detail, list):
            return " ".join(str(item) for item in detail)
        if detail:
            return str(detail)
    if isinstance(data, list):
        return " ".join(str(item) for item in data)
    return fallback


def _extract_validation_details(response):
    data = response.data
    if isinstance(data, dict):
        return data
    if isinstance(data, list):
        return {"non_field_errors": data}
    return {"detail": str(data)}


def _error_response(status_code, code, message, details=None):
    payload = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details is not None:
        payload["error"]["details"] = details
    return Response(payload, status=status_code)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    # Unhandled exceptions become secure 500 with error id.
    if response is None:
        error_id = uuid.uuid4().hex
        logger.exception("Unhandled exception", extra=_context_extra(context, status.HTTP_500_INTERNAL_SERVER_ERROR, error_id))
        details = {"error_id": error_id}
        if settings.DEBUG:
            details["exception"] = exc.__class__.__name__
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "internal_server_error",
            "Internal server error. Please try again later.",
            details=details,
        )

    status_code = response.status_code

    # Validation errors (serializer/model/input)
    if isinstance(exc, ValidationError) or status_code == status.HTTP_400_BAD_REQUEST:
        return _error_response(
            status.HTTP_400_BAD_REQUEST,
            "validation_error",
            "Validation failed.",
            details=_extract_validation_details(response),
        )

    # Authentication errors
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)) or status_code == status.HTTP_401_UNAUTHORIZED:
        return _error_response(
            status.HTTP_401_UNAUTHORIZED,
            "authentication_error",
            "Authentication credentials were not provided or are invalid.",
        )

    # Permission denied
    if isinstance(exc, PermissionDenied) or status_code == status.HTTP_403_FORBIDDEN:
        return _error_response(
            status.HTTP_403_FORBIDDEN,
            "permission_denied",
            "You do not have permission to perform this action.",
        )

    # Not found
    if status_code == status.HTTP_404_NOT_FOUND:
        return _error_response(
            status.HTTP_404_NOT_FOUND,
            "not_found",
            "Resource not found.",
        )

    # Custom business logic errors: use DRF exception code if set.
    if 400 <= status_code < 500:
        code = getattr(exc, "default_code", "business_error")
        return _error_response(
            status_code,
            str(code),
            _extract_message(response, "Request failed."),
        )

    # All server errors with traceback logging.
    error_id = uuid.uuid4().hex
    logger.exception("Server error response", extra=_context_extra(context, status_code, error_id))
    details = {"error_id": error_id}
    if settings.DEBUG:
        details["exception"] = exc.__class__.__name__
    return _error_response(
        status_code,
        "internal_server_error",
        "Internal server error. Please try again later.",
        details=details,
    )
