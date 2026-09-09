# 3D Print Lab Inventory System

Event-sourced inventory and print-request management system for a school
3D printing lab. See [DESIGN.md](./DESIGN.md) for the full specification —
architecture, domain model, event streams, invariants, business rules, and
testing requirements. Read that before touching code; it's the contract
everything here is built against.

## Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + TypeScript + Vite

## Project status

Release 0.1 (Foundation) — see DESIGN.md Section 10 for the full release
sequence.

## Getting started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API exposes:

- `GET /health`
- `GET/POST /materials`
- `GET/POST /spools`
- `GET /spools/{id}`
- `POST /spools/{id}/weight`
- `POST /spools/{id}/correct`
- `POST /spools/{id}/assign`
- `POST /spools/{id}/unassign`
- `GET/POST /machines`
- `GET/POST /requests`
- `POST /requests/{id}/reserve`
- `POST /requests/{id}/release`
- `POST /requests/{id}/fulfill`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

For local development, the frontend defaults to `http://localhost:8000` for the
API.

## GitHub Pages deployment

The frontend is configured to deploy to GitHub Pages from the workflow at
`/home/runner/work/print-lab-inventory/print-lab-inventory/.github/workflows/deploy-pages.yml`.

Before the hosted site will work end-to-end:

1. Deploy the FastAPI backend to a service that can run Python web apps.
2. Set the repository variable `VITE_API_BASE_URL` to that public backend URL.
3. Ensure the backend allows the frontend origin (`https://aspiece.github.io`).
4. Push to `main` or run the workflow manually from the Actions tab.

The workflow builds the Vite app, publishes `frontend/dist`, and copies
`index.html` to `404.html` so direct navigation to SPA routes keeps working on
GitHub Pages.
