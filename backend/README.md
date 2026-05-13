# Bee API Backend

Bee API is a FastAPI backend for OSINT-oriented news intelligence. It stores and analyzes online news, manages OSINT sources, tracks Word List matches, extracts signals for dashboard analytics, supports investigation records, notes, and relationship graphs, and exposes authenticated REST endpoints for the frontend.

## Features

- JWT-based authentication with username or email login.
- OSINT source management with active/inactive source state.
- Scheduled news scraping from active OSINT sources.
- News storage, article extraction, entity extraction, keyword matching, and basic sentiment classification.
- Dashboard analytics for KPIs, locations, term trends, source activity, and general WEB/TEXT sentiment.
- Word List monitoring with alerts, matched news, manual refresh, and manual background search execution.
- Notes with image uploads.
- Person/investigation records with phone numbers, addresses, social links, and document uploads.
- Relationship graphs with nodes, relationships, record import, node investigation, and document download support.
- Static file serving for uploaded notes and record documents.
- Alembic database migrations.
- Docker and local development workflows.

## Tech Stack

- Python 3.12
- FastAPI
- SQLAlchemy
- Pydantic v2
- Alembic
- APScheduler
- Uvicorn / Gunicorn
- Scrapling and readability-lxml for web extraction
- Groq SDK for optional LLM-backed workflows
- Loguru for logging
- Ruff and pytest for development quality checks

## Project Structure

```text
backend/
├── alembic/                 # Database migration environment and versions
├── app/
│   ├── api/                 # API routers and dependencies
│   ├── core/                # Config, security, logging, exception handlers, middleware
│   ├── infrastructure/      # Database, scheduler, LLM integration
│   ├── models/              # SQLAlchemy models
│   ├── repositories/        # Data access and analytics queries
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/            # Business logic
│   ├── utils/               # Entity and HTTP helpers
│   └── main.py              # FastAPI application entry point
├── deploy/                  # Development Docker Compose file
├── scripts/                 # Utility scripts
├── static/                  # Uploaded files served by FastAPI
├── tests/                   # Test suite
├── .env.example             # Environment template
├── alembic.ini              # Alembic configuration
├── Dockerfile               # Production/development Docker image
├── docker-compose.yml       # Base Docker Compose file
├── pyproject.toml           # Project metadata and tooling config
└── uv.lock                  # Locked dependency graph
```

## Requirements

- Python `>=3.12,<3.13`
- `uv` package manager
- SQLite for local development, or PostgreSQL for production-like deployments
- Optional: Docker and Docker Compose
- Optional: Groq API key for LLM-backed features

Install `uv` if needed:

```bash
pip install uv
```

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Main settings:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SECRET_KEY` | Yes | none | Secret used to sign access tokens. Use a long random value. |
| `DATABASE_URL` | Yes | `sqlite:///./database.db` in the example | SQLAlchemy database URL. Supports SQLite and PostgreSQL. |
| `ALLOWED_ORIGINS` | Yes | `["*"]` | CORS origins allowed by the API. |
| `GROQ_API_KEY` | No | none | API key for Groq-powered LLM workflows. |
| `LOG_LEVEL` | No | `INFO` | Logging level. |
| `LOG_JSON` | No | `false` | Emit JSON logs when enabled. |
| `HOST` | No | `127.0.0.1` | App host when running `python -m app.main`. |
| `PORT` | No | `8000` | App port when running `python -m app.main`. |
| `FETCH_INTERVAL_MINUTES` | No | `60` | Scheduled news scraping interval. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | JWT access token lifetime. |

Example SQLite development config:

```env
SECRET_KEY=change-this-to-a-long-random-secret
ALLOWED_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
DATABASE_URL=sqlite:///./database.db
GROQ_API_KEY=
LOG_LEVEL=INFO
LOG_JSON=false
FETCH_INTERVAL_MINUTES=60
```

Example PostgreSQL config:

```env
SECRET_KEY=change-this-to-a-long-random-secret
ALLOWED_ORIGINS=["https://your-frontend.example.com"]
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/bee
GROQ_API_KEY=your-groq-api-key
LOG_LEVEL=INFO
LOG_JSON=true
FETCH_INTERVAL_MINUTES=30
```

## Local Development

From the backend directory:

```bash
uv sync
```

Run migrations:

```bash
uv run alembic upgrade head
```

Create or update the default admin user:

```bash
uv run python default_user.py
```

Default development credentials created by `default_user.py`:

```text
username: admin
email: admin@example.com
password: admin123
```

Change these credentials before using the application outside local development.

Start the API:

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Useful URLs:

```text
Health check: http://127.0.0.1:8000/health
Swagger UI:   http://127.0.0.1:8000/docs
OpenAPI JSON: http://127.0.0.1:8000/openapi.json
API prefix:   http://127.0.0.1:8000/api/v1
```

## Running With Docker

Development Compose file:

```bash
docker compose -f deploy/docker-compose.dev.yml up --build
```

Base Compose file:

```bash
docker compose up --build
```

The development Compose file exposes the API on port `8000` and runs Uvicorn with reload.

## Authentication

Most API endpoints require a bearer token.

Login endpoint:

```http
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded
```

Body:

```text
username=admin
password=admin123
```

Response:

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer"
}
```

Use the token in authenticated requests:

```http
Authorization: Bearer jwt-token
```

Current user:

```http
GET /api/v1/auth/me
```

## Main API Areas

All versioned routes live under:

```text
/api/v1
```

### Auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/login` | Login with username/email and password. |
| `GET` | `/auth/me` | Return the authenticated user. |

### OSINT Sources

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/osint-sources` | List all OSINT sources. |
| `POST` | `/osint-sources` | Create a source. |
| `PUT` | `/osint-sources/{source_id}` | Update a source. |
| `DELETE` | `/osint-sources/{source_id}` | Delete a source. |

### News

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/news/` | Paginated news list. Supports `page` and `page_size`. |
| `GET` | `/news/{id}` | Get a single news item. |

News scraping is normally executed by the scheduler from active OSINT sources. Newly stored news is automatically matched against active Word Lists.

### Dashboard

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/dashboard/kpis` | Global dashboard counts. |
| `GET` | `/dashboard/entities` | Top named entities. |
| `GET` | `/dashboard/volume` | Daily news volume. |
| `GET` | `/dashboard/locations` | Top locations and previous-period comparison. |
| `GET` | `/dashboard/term-trends` | Trending terms from recent news. |
| `GET` | `/dashboard/source-activity` | Recent source activity ranking. |
| `GET` | `/dashboard/sentiment` | General WEB/TEXT sentiment report across all stored news in the selected period. |

### Word Lists

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/word-lists` | List Word Lists. |
| `POST` | `/word-lists` | Create a Word List. |
| `GET` | `/word-lists/{word_list_id}` | Get a Word List with matched news and alerts. |
| `PUT` | `/word-lists/{word_list_id}` | Update a Word List. |
| `DELETE` | `/word-lists/{word_list_id}` | Delete a Word List. |
| `GET` | `/word-lists/alerts` | List Word List alerts. |
| `PATCH` | `/word-lists/alerts/{alert_id}` | Mark an alert as read or unread with `is_read`. |
| `POST` | `/word-lists/{word_list_id}/refresh` | Match the Word List against already stored news. |
| `POST` | `/word-lists/{word_list_id}/run` | Start a background search: scrape active OSINT sources, store news, then refresh this Word List. |

### Notes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/notes/` | List notes. |
| `POST` | `/notes/` | Create a note. |
| `GET` | `/notes/{id}` | Get a note. |
| `PUT` | `/notes/{id}` | Update a note. |
| `DELETE` | `/notes/{id}` | Delete a note. |
| `POST` | `/notes/images` | Upload an image for note content. |

### Records

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/records/` | List records. Supports `search`. |
| `POST` | `/records/` | Create a record. |
| `GET` | `/records/{id}` | Get a record. |
| `PUT` | `/records/{id}` | Update a record. |
| `DELETE` | `/records/{id}` | Delete a record. |
| `POST` | `/records/{id}/documents` | Upload a document for a record. |
| `GET` | `/records/documents/{doc_id}/download` | Download a record document. |
| `DELETE` | `/records/documents/{doc_id}` | Delete a record document. |

### Graphs

Canonical graph routes are exposed under `/api/v1/graphs`. A legacy `/api/v1/graph` alias is also mounted for frontend compatibility and is hidden from the OpenAPI schema.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/graphs/` | List graphs. |
| `POST` | `/graphs/` | Create a graph. |
| `DELETE` | `/graphs/{id}` | Delete a graph. |
| `GET` | `/graphs/{id}/data` | Get graph nodes and relationships. |
| `POST` | `/graphs/{id}/import-record/{record_id}` | Import a record into a graph. |
| `POST` | `/graphs/{id}/investigate/{node_id}` | Investigate a graph node and link related news. |
| `GET` | `/graphs/{graph_id}/documents/{node_id}/download` | Download a document linked through a graph node. |
| `POST` | `/graphs/nodes` | Create a graph node. |
| `PUT` | `/graphs/nodes/{id}` | Update a graph node. |
| `DELETE` | `/graphs/nodes/{id}` | Delete a graph node. |
| `POST` | `/graphs/relationships` | Create a relationship. |
| `DELETE` | `/graphs/relationships/{id}` | Delete a relationship. |

## Scheduler

The application starts an APScheduler job during FastAPI lifespan startup. The job:

1. Loads active OSINT sources.
2. Scrapes source indexes.
3. Extracts candidate articles.
4. Stores new news items.
5. Matches new items against active Word Lists.

The interval is controlled by:

```env
FETCH_INTERVAL_MINUTES=60
```

The scheduler starts automatically when the FastAPI application starts.

## Static Files and Uploads

Uploaded files are stored under:

```text
static/uploads/notes
static/uploads/records
```

These directories are created automatically at app startup. The app mounts `/static`, so uploaded files can be served through URLs such as:

```text
/static/uploads/notes/<file-name>
```

## Database Migrations

Create a new migration:

```bash
uv run alembic revision --autogenerate -m "describe change"
```

Apply migrations:

```bash
uv run alembic upgrade head
```

Downgrade one migration:

```bash
uv run alembic downgrade -1
```

Show migration history:

```bash
uv run alembic history
```

## Quality Checks

Run Ruff:

```bash
uv run ruff check app tests
```

Format with Ruff:

```bash
uv run ruff format app tests
```

Run tests:

```bash
uv run pytest
```

Compile all Python modules:

```bash
uv run python -m compileall app
```

## Common Development Commands

```bash
# Install dependencies
uv sync

# Apply database migrations
uv run alembic upgrade head

# Create default admin user
uv run python default_user.py

# Start local API with reload
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Run lint checks
uv run ruff check app tests

# Run tests
uv run pytest
```

## Security Notes

- Do not reuse the default admin credentials outside local development.
- Replace `SECRET_KEY` with a long, random secret.
- Do not use `ALLOWED_ORIGINS=["*"]` in production.
- Keep `.env` out of version control.
- Uploaded files are served from `/static`; validate deployment exposure and storage policies before production use.
- The scraper fetches third-party web content. Use reasonable intervals and respect source availability, robots policies, and applicable law.

## Troubleshooting

### The API starts but `/docs` shows authentication errors

Login through `/api/v1/auth/login` and use the returned bearer token in Swagger UI's Authorize dialog.

### Database tables are missing

Run:

```bash
uv run alembic upgrade head
```

### Login fails with the default user

Create or reset the default user:

```bash
uv run python default_user.py
```

### Scraping is not producing news

Check that:

- At least one OSINT source exists.
- The source is active.
- The source URL is reachable from the backend environment.
- `FETCH_INTERVAL_MINUTES` is configured as expected.
- Logs do not show extraction or network errors.

### Uploaded files are not available

Check that the `static/uploads/notes` and `static/uploads/records` directories exist and that the process has write permissions.

## Contributing

Contribution guidelines are centralized at [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
