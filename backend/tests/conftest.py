# conftest.py
#

import pytest
from app import models  # noqa: F401 - registers all models with Base
from app.database import Base, get_db
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


@pytest.fixture
def db_session():
    """
    Provide a fresh in-memory SQLite database for each test.

    The database exists only for the duration of the test and is
    completely separate from the application's real database.
    """

    # Create an isolated in-memory database for the test.
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables defined by our SQLAlchemy models.
    Base.metadata.create_all(test_engine)

    # Create a session connected to the test database.
    with Session(test_engine) as session:
        yield session  # Provide the session to the test.

    # Clean up the temporary database resources.
    Base.metadata.drop_all(test_engine)
    test_engine.dispose()


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
