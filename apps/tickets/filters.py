import django_filters
from django.db.models import Q

from .models import Ticket


class TicketFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=Ticket.Status.choices)
    urgency = django_filters.ChoiceFilter(choices=Ticket.Urgency.choices)
    assignee = django_filters.UUIDFilter(field_name="assignee_id")
    requestor = django_filters.UUIDFilter(field_name="requestor_id")
    workbench = django_filters.UUIDFilter(field_name="workbench_id")
    # Full-text search across title, description, and asset_id
    search = django_filters.CharFilter(method="filter_search")

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(title__icontains=value)
            | Q(description__icontains=value)
            | Q(asset_id__icontains=value)
        )

    class Meta:
        model = Ticket
        fields = ["status", "urgency", "assignee", "requestor", "workbench", "category"]
