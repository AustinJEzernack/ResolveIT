"""
Reusable DRF permission classes shared across all apps.
"""
from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Allow access only to users with the OWNER role."""

    message = "Only workshop owners can perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "OWNER"
        )


class IsOwnerOrTechnician(BasePermission):
    """Allow any authenticated workshop member (Owner or Technician)."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsSameWorkshop(BasePermission):
    """
    Object-level: the target object must belong to the requesting user's workshop.
    Expects the object to have a `workshop` or `workshop_id` attribute.
    """

    message = "You do not have access to this resource."

    def has_object_permission(self, request, view, obj):
        obj_workshop_id = getattr(obj, "workshop_id", None) or getattr(
            getattr(obj, "workshop", None), "id", None
        )
        return str(obj_workshop_id) == str(request.user.workshop_id)
