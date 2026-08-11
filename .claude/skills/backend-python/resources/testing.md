# Testing Patterns

pytest, async testing, mocking, and test organization.

<rules>
- ALWAYS use Arrange-Act-Assert structure with one assertion focus per test (multi-assertion tests hide which behavior broke)
- ALWAYS use `AsyncMock` for async dependencies and factories for test data (manual dict construction drifts from real models over time)
- ALWAYS use `pytest.fixture` for shared setup and `dependency_overrides` for integration tests (global state between tests causes flaky failures)
- ALWAYS test behavior, not implementation — assert on outputs and side effects, not internal calls (implementation-coupled tests break on every refactor)
- NEVER use real databases or external services in unit tests (slow, flaky, and impossible to run in CI without infrastructure)
- NEVER test multiple behaviors in one test function (when it fails, you cannot tell which behavior is broken)
</rules>

---

## Test Structure

```python
class TestUserService:
    async def test_create_user_success(self, service, mock_repo):
        mock_repo.find_by_email.return_value = None
        mock_repo.create.return_value = create_user(id="123")

        result = await service.create(
            UserCreate(email="test@example.com", name="Test", password="password123")
        )

        assert result.id == "123"
        mock_repo.create.assert_called_once()

    async def test_create_duplicate_email_raises(self, service, mock_repo):
        mock_repo.find_by_email.return_value = create_user()
        with pytest.raises(ConflictError, match="already registered"):
            await service.create(UserCreate(email="taken@example.com", name="T", password="pass1234"))
```

---

## Fixtures

```python
@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.find_by_id = AsyncMock()
    repo.find_by_email = AsyncMock()
    repo.create = AsyncMock()
    return repo

@pytest.fixture
def service(mock_repo):
    return UserService(mock_repo)

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
```

Set `asyncio_mode = "auto"` in pyproject.toml to avoid marking every test with `@pytest.mark.asyncio`.

---

## Test Factories

```python
def create_user(id: str | None = None, email: str | None = None, name: str = "Test User") -> User:
    return User(
        id=id or str(uuid4()),
        email=email or f"user-{uuid4()}@example.com",
        name=name, roles=["user"],
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    )
```

---

## Integration Tests

Override dependencies for database mocking. Use `mongomock_motor` for MongoDB or `dependency_overrides` for service-level mocks.

```python
@pytest.fixture
async def client(mock_db):
    app.dependency_overrides[get_database] = lambda: mock_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

---

## Parametrized Tests

Use `@pytest.mark.parametrize` for input/output variations like email validation, error status codes, and edge cases.

---

## Auth Fixtures

```python
@pytest.fixture
def auth_headers():
    token = create_access_token(user_id="test-id", email="test@example.com", roles=["user"])
    return {"Authorization": f"Bearer {token}"}
```

---

## Edge Cases

- **Async fixture cleanup**: Use `yield` in async fixtures, not `return`. Code after `yield` runs as teardown.
- **Testing retries**: Set `side_effect` to a list of exceptions followed by a success value to verify retry behavior and call counts.
- **Mocking time**: Use `freezegun` or `time_machine` for deterministic datetime testing, especially for token expiry and TTL logic.

---

## Rules Summary

Structure tests as Arrange-Act-Assert with one behavior per test. Use AsyncMock for async dependencies and factories for test data. Override FastAPI dependencies for integration tests. Use parametrize for input variations. Keep unit tests fast by mocking all external dependencies. Test behavior (inputs/outputs), not implementation (internal method calls). Clean up fixtures with yield and clear dependency_overrides after each test.
