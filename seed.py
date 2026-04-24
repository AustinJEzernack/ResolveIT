"""
Run with: python manage.py shell < seed.py
Creates a workshop, workbench, owner user, and 2 sample tickets.
"""
import django
django.setup()

from apps.accounts.models import User
from apps.workshops.models import Workshop, Workbench
from apps.tickets.models import Ticket

# --- Workshop ---
workshop, _ = Workshop.objects.get_or_create(
    slug='acme-it',
    defaults={'name': 'Acme IT', 'description': 'Sample workshop'}
)
print(f'Workshop: {workshop.name}')

# --- Workbench ---
workbench, _ = Workbench.objects.get_or_create(
    workshop=workshop,
    name='General Support',
    defaults={'color': '#e03131', 'description': 'General support workbench'}
)
print(f'Workbench: {workbench.name}')

# --- Owner user ---
if not User.objects.filter(email='owner@acme.com').exists():
    owner = User.objects.create_user(
        email='owner@acme.com',
        password='Password123!',
        first_name='Alex',
        last_name='Reynolds',
        role='OWNER',
        workshop=workshop,
    )
    print(f'User created: {owner.email}')
else:
    owner = User.objects.get(email='owner@acme.com')
    print(f'User exists: {owner.email}')

# --- Tickets ---
t1, created = Ticket.objects.get_or_create(
    title='VPN keeps dropping for remote users',
    defaults={
        'description': 'Multiple remote users are reporting that their VPN connection drops every 30 minutes.',
        'status': Ticket.Status.OPEN,
        'urgency': Ticket.Urgency.HIGH,
        'category': 'Network',
        'workshop': workshop,
        'workbench': workbench,
        'requestor': owner,
    }
)
print(f'Ticket 1 {"created" if created else "exists"}: {t1.title}')

t2, created = Ticket.objects.get_or_create(
    title='Printer offline in Building B',
    defaults={
        'description': 'The shared printer on the 2nd floor of Building B is showing as offline.',
        'status': Ticket.Status.IN_PROGRESS,
        'urgency': Ticket.Urgency.MEDIUM,
        'category': 'Hardware',
        'workshop': workshop,
        'workbench': workbench,
        'requestor': owner,
    }
)
print(f'Ticket 2 {"created" if created else "exists"}: {t2.title}')

print('\nDone! Login with: owner@acme.com / Password123!')
