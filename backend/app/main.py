from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401
from app.api import machines, materials, requests, spools
from app.config import settings
from app.database import Base, engine


def _ensure_sqlite_directory() -> None:
    prefix = "sqlite:///"
    if not settings.database_url.startswith(prefix):
        return

    sqlite_path = settings.database_url.removeprefix(prefix)
    if sqlite_path == ":memory:" or sqlite_path.startswith("/"):
        return

    database_file = Path(sqlite_path)
    database_file.parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_directory()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="3D Print Lab Inventory API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(materials.router, prefix="/materials", tags=["materials"])
app.include_router(spools.router, prefix="/spools", tags=["spools"])
app.include_router(machines.router, prefix="/machines", tags=["machines"])
app.include_router(requests.router, prefix="/requests", tags=["requests"])


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
