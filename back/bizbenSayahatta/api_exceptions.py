from rest_framework import status
from rest_framework.exceptions import APIException


class BusinessLogicError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Business rule violation."
    default_code = "business_rule_violation"


class ResourceConflictError(BusinessLogicError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Resource conflict."
    default_code = "resource_conflict"


class MapPlaceAlreadyExistsError(ResourceConflictError):
    default_detail = "This map place already exists for the user."
    default_code = "map_place_already_exists"

