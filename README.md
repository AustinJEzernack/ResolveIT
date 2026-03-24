# ResolveIT

A Django REST API backend for an IT help desk and ticket management platform. ResolveIT supports multi-tenant workshop organizations, real-time messaging via WebSockets, JWT authentication, and encrypted communications.

---

## Features

- **Ticket Management** — Create, assign, and track IT support tickets with status (`OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`) and urgency levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- **Work Logs** — Technicians can log time and notes directly on tickets
- **Workshops & Workbenches** — Multi-tenant support; users and tickets are scoped to their workshop
- **Messaging** — Channel-based messaging with end-to-end encryption and real-time delivery via Django Channels (WebSockets)
- **JWT Authentication** — Secure login with rotating refresh tokens and token blacklisting
- **Role-Based Access** — `OWNER` and `TECHNICIAN` roles with permission enforcement
- **Audit Logging & Notifications** — Core audit trail and in-app notification system
- **OpenAPI Docs** — Auto-generated Swagger UI at `/api/docs/`
- **Admin Panel** — Jazzmin-themed Django admin at `/admin/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Django 5 + Django REST Framework |
| Auth | SimpleJWT (rotating refresh tokens) |
| Real-time | Django Channels + Redis |
| Database | PostgreSQL (via psycopg2) |
| Encryption | cryptography (Fernet) |
| API Docs | drf-spectacular (OpenAPI/Swagger) |
| Admin UI | Jazzmin |
| Server | Uvicorn (ASGI) |

---

## Project Structure

```
ResolveIT/
├── apps/
│   ├── accounts/      # Custom user model, JWT auth
│   ├── core/          # Shared utilities: audit, encryption, permissions, pagination
│   ├── messaging/     # Channels, messages, real-time WebSocket consumers
│   ├── tickets/       # Tickets, tags, work logs
│   └── workshops/     # Workshop and workbench models
├── config/
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── manage.py
└── requirements.txt
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL
- Redis

### Installation

```bash
# Clone the repo
git clone https://github.com/AustinJEzernack/ResolveIT.git
cd ResolveIT

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the project root:

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://user:password@localhost:5432/resolveit
REDIS_URL=redis://localhost:6379
MESSAGE_ENCRYPTION_KEY=your-fernet-key
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

To generate a Fernet key:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

### Run Migrations & Start Server

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

For WebSocket support, run with Uvicorn:
```bash
uvicorn config.asgi:application --reload
```

---

## API Endpoints

| Prefix | Description |
|---|---|
| `POST /api/auth/` | Register, login, token refresh |
| `GET/POST /api/tickets/` | Ticket CRUD |
| `GET/POST /api/workshops/` | Workshop management |
| `GET/POST /api/workbenches/` | Workbench management |
| `GET/POST /api/messaging/` | Channels and messages |
| `GET /api/docs/` | Swagger UI |
| `GET /api/schema/` | Raw OpenAPI schema |
| `GET /health/` | Health check |

---

## License

This project is for educational and personal use.
