"""Tests for detection override endpoint and state management.

Tests override state set/get/clear, concurrent overrides,
invalid category rejection, and the REST endpoint.
"""

import pytest
from fastapi import FastAPI

from src.routes.override import (
    OverrideRequest,
    OverrideResponse,
    router as override_router,
)
from src.services.override_state import (
    _overrides,
    check_override,
    clear_override,
    set_override,
)


@pytest.fixture(autouse=True)
def clean_overrides():
    """Ensure override state is clean before and after each test."""
    _overrides.clear()
    yield
    _overrides.clear()


class TestCheckOverride:
    """Test check_override() state lookup."""

    def test_returns_none_when_no_override(self):
        assert check_override("video-123") is None

    def test_returns_override_when_set(self):
        _overrides["video-123"] = {
            "category": "fitness",
            "persona": "fitness",
            "output_type": "workout",
        }
        result = check_override("video-123")
        assert result is not None
        assert result["category"] == "fitness"
        assert result["persona"] == "fitness"
        assert result["output_type"] == "workout"

    def test_returns_none_for_different_id(self):
        _overrides["video-123"] = {
            "category": "fitness",
            "persona": "fitness",
            "output_type": "workout",
        }
        assert check_override("video-456") is None


class TestClearOverride:
    """Test clear_override() cleanup."""

    def test_clears_existing_override(self):
        _overrides["video-123"] = {
            "category": "fitness",
            "persona": "fitness",
            "output_type": "workout",
        }
        clear_override("video-123")
        assert "video-123" not in _overrides
        assert check_override("video-123") is None

    def test_no_error_when_clearing_nonexistent(self):
        clear_override("nonexistent")

    def test_only_clears_specified_id(self):
        _overrides["video-123"] = {"category": "fitness", "persona": "fitness", "output_type": "workout"}
        _overrides["video-456"] = {"category": "cooking", "persona": "recipe", "output_type": "recipe"}
        clear_override("video-123")
        assert check_override("video-123") is None
        assert check_override("video-456") is not None


class TestConcurrentOverrides:
    """Test multiple overrides for different pipelines."""

    def test_independent_overrides(self):
        _overrides["video-1"] = {"category": "cooking", "persona": "recipe", "output_type": "recipe"}
        _overrides["video-2"] = {"category": "coding", "persona": "code", "output_type": "tutorial"}

        r1 = check_override("video-1")
        r2 = check_override("video-2")

        assert r1 is not None
        assert r1["output_type"] == "recipe"
        assert r2 is not None
        assert r2["output_type"] == "tutorial"

    def test_override_replacement(self):
        _overrides["video-1"] = {"category": "cooking", "persona": "recipe", "output_type": "recipe"}
        _overrides["video-1"] = {"category": "fitness", "persona": "fitness", "output_type": "workout"}

        result = check_override("video-1")
        assert result is not None
        assert result["output_type"] == "workout"


@pytest.fixture
def test_app():
    """Minimal FastAPI app with only the override router for testing."""
    app = FastAPI()
    app.include_router(override_router)
    return app


@pytest.fixture
def valid_secret():
    """Return the internal secret from config for authenticated test requests."""
    from src.config import settings
    return settings.INTERNAL_SECRET


class TestOverrideEndpoint:
    """Test the POST /override/{video_summary_id} endpoint."""

    @pytest.mark.anyio
    async def test_valid_override(self, test_app, valid_secret):
        from httpx import AsyncClient, ASGITransport

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/override/video-123",
                json={"category": "cooking"},
                headers={"X-Internal-Secret": valid_secret},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "cooking"
        assert data["outputType"] == "recipe"
        assert data["persona"] == "recipe"
        assert data["outputTypeLabel"] == "Recipe"

    @pytest.mark.anyio
    async def test_missing_secret_returns_401(self, test_app):
        from httpx import AsyncClient, ASGITransport

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/override/video-123",
                json={"category": "cooking"},
            )

        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_invalid_secret_returns_401(self, test_app):
        from httpx import AsyncClient, ASGITransport

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/override/video-123",
                json={"category": "cooking"},
                headers={"X-Internal-Secret": "wrong-secret"},
            )

        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_invalid_category_returns_422(self, test_app, valid_secret):
        from httpx import AsyncClient, ASGITransport

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/override/video-123",
                json={"category": "invalid_category"},
                headers={"X-Internal-Secret": valid_secret},
            )

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_override_sets_state(self, test_app, valid_secret):
        from httpx import AsyncClient, ASGITransport

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://test",
        ) as client:
            await client.post(
                "/override/video-test",
                json={"category": "fitness"},
                headers={"X-Internal-Secret": valid_secret},
            )

        result = check_override("video-test")
        assert result is not None
        assert result["category"] == "fitness"
        assert result["output_type"] == "workout"

    @pytest.mark.anyio
    async def test_category_case_insensitive(self, test_app, valid_secret):
        from httpx import AsyncClient, ASGITransport

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/override/video-123",
                json={"category": "Cooking"},
                headers={"X-Internal-Secret": valid_secret},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "cooking"

    @pytest.mark.anyio
    async def test_category_stripped(self, test_app, valid_secret):
        from httpx import AsyncClient, ASGITransport

        async with AsyncClient(
            transport=ASGITransport(app=test_app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/override/video-123",
                json={"category": "  cooking  "},
                headers={"X-Internal-Secret": valid_secret},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "cooking"


class TestSetOverride:
    """Test set_override() function."""

    def test_sets_override(self):
        set_override("video-1", {"category": "cooking", "persona": "recipe", "output_type": "recipe"})
        result = check_override("video-1")
        assert result is not None
        assert result["category"] == "cooking"

    def test_refreshes_insertion_order_on_replace(self):
        """Replacing a key should move it to the end for correct FIFO eviction."""
        set_override("video-1", {"category": "cooking", "persona": "recipe", "output_type": "recipe"})
        set_override("video-2", {"category": "coding", "persona": "code", "output_type": "tutorial"})
        # Replace video-1 — should now be after video-2
        set_override("video-1", {"category": "fitness", "persona": "fitness", "output_type": "workout"})

        keys = list(_overrides.keys())
        assert keys == ["video-2", "video-1"]

    def test_evicts_oldest_at_capacity(self):
        from src.services.override_state import _MAX_OVERRIDES

        # Fill to capacity
        for i in range(_MAX_OVERRIDES):
            set_override(f"v-{i}", {"category": "cooking", "persona": "recipe", "output_type": "recipe"})

        assert len(_overrides) == _MAX_OVERRIDES

        # Adding one more should evict the first
        set_override("new-video", {"category": "fitness", "persona": "fitness", "output_type": "workout"})
        assert len(_overrides) == _MAX_OVERRIDES
        assert check_override("v-0") is None
        assert check_override("new-video") is not None


class TestOverrideRequestModel:
    """Test Pydantic models for override."""

    def test_valid_request(self):
        req = OverrideRequest(category="cooking")
        assert req.category == "cooking"

    def test_response_model(self):
        resp = OverrideResponse(
            category="cooking",
            outputType="recipe",
            outputTypeLabel="Recipe",
            persona="recipe",
        )
        assert resp.category == "cooking"
        assert resp.outputType == "recipe"
