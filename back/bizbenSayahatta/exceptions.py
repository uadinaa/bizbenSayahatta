from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return Response(
            {
                "detail": "Internal server error. Please try again later.",
                "code": "internal_server_error",
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data.get("detail") if isinstance(response.data, dict) else None
    if not detail:
        if response.status_code >= 500:
            detail = "Internal server error. Please try again later."
        elif response.status_code == 404:
            detail = "Resource not found."
        elif response.status_code == 403:
            detail = "You do not have permission to perform this action."
        elif response.status_code == 401:
            detail = "Authentication credentials were not provided or are invalid."
        elif response.status_code == 400:
            detail = "Invalid request payload."
        else:
            detail = "Request failed."

    response.data = {
        "detail": detail,
        "status_code": response.status_code,
    }
    return response
