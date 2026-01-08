# Testing Patterns

pytest, async testing, mocking, and test organization.

---

## Test Structure

### DO ✅

```python
# Arrange-Act-Assert pattern
class TestUserService:
    async def test_create_user_success(self, user_service, mock_repo):
        # Arrange
        mock_repo.find_by_email.return_value = None
        mock_repo.create.return_value = create_user(id="123")

        # Act
        result = await user_service.create(
            UserCreate(email="test@example.com", name="Test", password="password123")
        )

        # Assert
        assert result.id == "123"
        mock_repo.create.assert_called_once()

    async def test_create_user_duplicate_email_raises(self, user_service, mock_repo):
        # Arrange
        mock_repo.find_by_email.return_value = create_user()

        # Act & Assert
        with pytest.raises(ConflictError, match="already registered"):
            await user_service.create(
                UserCreate(email="taken@example.com", name="Test", password="password123")
            )
```

### DON'T ❌

```python
# No structure, multiple assertions
async def test_user():
    user = await service.create(data)
    assert user is not None
    updated = await service.update(user.id, update_data)
    assert updated.name == update_data.name
    await service.delete(user.id)
    assert await service.find_by_id(user.id) is None
    # Testing too many things!
```

---

## Pytest Configuration

### DO ✅

```python
# conftest.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.database import get_database


@pytest.fixture
def mock_repo():
    """Mock repository."""
    repo = AsyncMock()
    repo.find_by_id = AsyncMock()
    repo.find_by_email = AsyncMock()
    repo.create = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def user_service(mock_repo):
    """User service with mocked dependencies."""
    from app.users.service import UserService
    return UserService(mock_repo)


@pytest.fixture
async def client():
    """Test client."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
```

### pyproject.toml

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
filterwarnings = ["ignore::DeprecationWarning"]

[tool.coverage.run]
source = ["app"]
omit = ["app/tests/*", "app/__init__.py"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```

---

## Unit Testing Services

### DO ✅

```python
import pytest
from unittest.mock import AsyncMock

from app.users.service import UserService
from app.users.schemas import UserCreate
from app.core.exceptions import NotFoundError, ConflictError
from tests.factories import create_user, create_user_input


class TestUserService:
    @pytest.fixture
    def mock_repo(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_repo):
        return UserService(mock_repo)

    async def test_find_by_id_returns_user(self, service, mock_repo):
        user = create_user(id="123")
        mock_repo.find_by_id.return_value = user

        result = await service.find_by_id("123")

        assert result == user
        mock_repo.find_by_id.assert_called_once_with("123")

    async def test_find_by_id_raises_not_found(self, service, mock_repo):
        mock_repo.find_by_id.return_value = None

        with pytest.raises(NotFoundError):
            await service.find_by_id("123")

    async def test_create_hashes_password(self, service, mock_repo):
        mock_repo.find_by_email.return_value = None
        mock_repo.create.return_value = create_user(id="new")

        await service.create(create_user_input(password="plaintext"))

        call_args = mock_repo.create.call_args
        assert "password_hash" in call_args.kwargs
        assert call_args.kwargs["password_hash"] != "plaintext"
        assert call_args.kwargs["password_hash"].startswith("$2b$")
```

---

## Integration Testing Routes

### DO ✅

```python
import pytest
from httpx import AsyncClient


class TestUserRoutes:
    async def test_create_user_success(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/users",
            json={
                "email": "test@example.com",
                "name": "Test User",
                "password": "password123",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == "test@example.com"
        assert "password" not in data["data"]

    async def test_create_user_invalid_email(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/users",
            json={
                "email": "invalid-email",
                "name": "Test",
                "password": "password123",
            },
        )

        assert response.status_code == 422
        assert response.json()["success"] is False

    async def test_get_user_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/users/123")

        assert response.status_code == 401

    async def test_get_user_with_auth(self, client: AsyncClient, auth_headers):
        response = await client.get(
            "/api/v1/users/123",
            headers=auth_headers,
        )

        # May be 404 if user doesn't exist, but not 401
        assert response.status_code in (200, 404)
```

---

## Test Factories

### DO ✅

```python
# tests/factories.py
from datetime import datetime, UTC
from uuid import uuid4

from app.users.models import User
from app.users.schemas import UserCreate


def create_user(
    id: str | None = None,
    email: str | None = None,
    name: str = "Test User",
    roles: list[str] | None = None,
) -> User:
    """Factory for User model."""
    return User(
        id=id or str(uuid4()),
        email=email or f"user-{uuid4()}@example.com",
        name=name,
        roles=roles or ["user"],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def create_user_input(
    email: str | None = None,
    name: str = "Test User",
    password: str = "password123",
) -> UserCreate:
    """Factory for UserCreate schema."""
    return UserCreate(
        email=email or f"user-{uuid4()}@example.com",
        name=name,
        password=password,
    )
```

---

## Mocking Dependencies

### DO ✅

```python
import pytest
from unittest.mock import AsyncMock, patch


@pytest.fixture
def mock_email_service():
    with patch("app.users.service.email_service") as mock:
        mock.send_welcome = AsyncMock()
        yield mock


async def test_create_sends_welcome_email(service, mock_repo, mock_email_service):
    mock_repo.find_by_email.return_value = None
    mock_repo.create.return_value = create_user(email="test@example.com")

    await service.create(create_user_input(email="test@example.com"))

    mock_email_service.send_welcome.assert_called_once_with("test@example.com")
```

---

## Database Testing

### DO ✅

```python
import pytest
from mongomock_motor import AsyncMongoMockClient


@pytest.fixture
async def mock_db():
    """Mock MongoDB for testing."""
    client = AsyncMongoMockClient()
    db = client["test_db"]
    yield db
    client.close()


@pytest.fixture
async def client(mock_db):
    """Test client with mocked database."""
    from app.main import app
    from app.core.database import get_database

    async def override_get_database():
        return mock_db

    app.dependency_overrides[get_database] = override_get_database

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()
```

---

## Testing Async Code

### DO ✅

```python
import pytest
import asyncio


async def test_concurrent_operations():
    """Test parallel async operations."""
    results = await asyncio.gather(
        service.find_by_id("1"),
        service.find_by_id("2"),
        service.find_by_id("3"),
    )
    assert len(results) == 3


async def test_timeout():
    """Test timeout handling."""
    with pytest.raises(asyncio.TimeoutError):
        async with asyncio.timeout(0.1):
            await slow_operation()


async def test_retry_logic(mock_external_api):
    """Test retry on failure."""
    mock_external_api.call.side_effect = [
        ConnectionError("First fail"),
        ConnectionError("Second fail"),
        {"success": True},
    ]

    result = await service.call_with_retry()

    assert result["success"] is True
    assert mock_external_api.call.call_count == 3
```

---

## Parametrized Tests

### DO ✅

```python
import pytest


@pytest.mark.parametrize(
    "email,expected_valid",
    [
        ("user@example.com", True),
        ("user@sub.example.com", True),
        ("invalid", False),
        ("@example.com", False),
        ("user@", False),
        ("", False),
    ],
)
def test_email_validation(email: str, expected_valid: bool):
    if expected_valid:
        # Should not raise
        UserCreate(email=email, name="Test", password="password123")
    else:
        with pytest.raises(ValueError):
            UserCreate(email=email, name="Test", password="password123")


@pytest.mark.parametrize(
    "status_code,error_class",
    [
        (400, ValidationError),
        (401, UnauthorizedError),
        (403, ForbiddenError),
        (404, NotFoundError),
        (409, ConflictError),
    ],
)
def test_error_status_codes(status_code: int, error_class: type):
    error = error_class("Test message")
    assert error.status_code == status_code
```

---

## Test Auth Fixtures

### DO ✅

```python
@pytest.fixture
def auth_token():
    """Generate valid auth token for testing."""
    from app.core.security import create_access_token
    return create_access_token(
        user_id="test-user-id",
        email="test@example.com",
        roles=["user"],
    )


@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def admin_headers():
    """Headers with admin token."""
    from app.core.security import create_access_token
    token = create_access_token(
        user_id="admin-id",
        email="admin@example.com",
        roles=["admin"],
    )
    return {"Authorization": f"Bearer {token}"}
```

---

## Quick Reference

| Test Type | What to Test | Mock? |
|-----------|--------------|-------|
| Unit | Single function/class | All dependencies |
| Integration | Route → Service | External only |
| E2E | Full user flow | Nothing |

| Pattern | When to Use |
|---------|-------------|
| Factory | Create test data |
| AsyncMock | Mock async functions |
| patch | Replace modules/functions |
| parametrize | Test multiple inputs |

| Rule | Why |
|------|-----|
| One assertion per test | Clear failure reason |
| Fresh fixtures per test | No pollution |
| Test behavior, not implementation | Refactor-proof |
| Test edge cases | Find real bugs |
