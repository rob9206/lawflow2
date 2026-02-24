# AGENTS.md

## Cursor Cloud specific instructions

### Overview

LawFlow is an AI-powered law school study platform. It consists of two services:

| Service | Tech | Port | Command |
|---------|------|------|---------|
| Backend (Flask API) | Python 3.12, Flask, SQLAlchemy, SQLite | 5002 | `source venv/bin/activate && PYTHONPATH=/workspace python api/app.py` |
| Frontend (Vite dev) | React 19, TypeScript, Vite 6, Tailwind 4 | 5173 | `cd frontend && npm run dev -- --strictPort` |

### Key caveats

- **PYTHONPATH required**: The backend uses `from api.…` imports. You must set `PYTHONPATH=/workspace` (or run from `/workspace`) when executing `python api/app.py`. Without it you get `ModuleNotFoundError: No module named 'api'`.
- **Reloader disabled by default**: `api/app.py` runs with `use_reloader=False` because the module-level `create_app()` causes infinite restart loops with Flask's stat reloader. For auto-reloading, use `flask --app api.app:create_app run --reload` instead.
- **SQLite auto-creates on startup**: The database file `data/lawflow.db` is created automatically when the backend starts; no migration tool is used.
- **Vite proxies `/api` to Flask**: In dev mode, `vite.config.ts` proxies all `/api/*` requests to `http://127.0.0.1:5002`, so the frontend and backend must both be running.
- **`ANTHROPIC_API_KEY` env var**: Required for AI features (tutor, auto-teach, exams, document processing). The app starts without it but logs a warning; AI endpoints will fail.
- **No ESLint configured**: The frontend has no linter. Use `npx tsc -b --noEmit` for type checking.
- **No automated test suite**: There are currently no test frameworks (pytest, vitest, jest) configured. Validation is manual.

### Standard commands reference

See `SETUP.md` for full setup instructions. Key commands:

- **Install backend deps**: `source venv/bin/activate && pip install -r requirements.txt`
- **Install frontend deps**: `cd frontend && npm install`
- **Type-check frontend**: `cd frontend && npx tsc -b --noEmit`
- **Build frontend**: `cd frontend && npm run build`
