# Contributing to Bee

Thank you for improving Bee. This repository is a full-stack OSINT intelligence platform with a FastAPI backend and a React frontend. Contributions should keep the system reliable, readable, and useful for operational analysis.

## Repository Structure

```text
bee/
  backend/     FastAPI API, services, models, migrations, tests
  frontend/    React and Vite application
  docs/        Shared documentation assets
  README.md    Main project README
```

## Development Workflow

1. Create a focused branch for your change.
2. Keep changes scoped to the feature, bug fix, or documentation task.
3. Update tests or documentation when behavior changes.
4. Run the relevant checks before submitting the change.
5. Describe the user-visible impact clearly in the pull request.

## Backend Setup

```bash
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python default_user.py
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend checks:

```bash
cd backend
uv run ruff check app tests
uv run pytest
uv run python -m compileall app
```

## Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

## Code Style

- Follow the patterns already used in the area you are changing.
- Keep API behavior explicit and documented when adding endpoints.
- Keep frontend components focused on one screen or reusable UI concern.
- Prefer existing helpers, services, and shared components before adding new abstractions.
- Avoid unrelated formatting, renaming, or refactors in feature branches.

## Database Changes

When backend models change, create an Alembic migration:

```bash
cd backend
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

Review generated migrations before committing them.

## Pull Request Checklist

- The change has a clear purpose.
- Relevant tests or build checks pass.
- Documentation is updated when needed.
- Database migrations are included when models change.
- The root `LICENSE` and this contribution guide remain the authoritative shared project documents.

## License

By contributing, you agree that your contribution is provided under the repository license. See [LICENSE](LICENSE).
