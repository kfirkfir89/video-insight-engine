"""Dependency management for vie-explainer MCP server.

Non-FastAPI dependency injection using module-level getters.
MongoDB client is initialized during Starlette lifespan.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from src.config import settings
from src.logging_config import get_logger
from src.repositories.mongodb_repository import (
    MongoExpansionRepository,
    MongoVideoSummaryRepository,
)
from src.services.llm import LLMService
from src.services.llm_provider import LLMProvider

logger = get_logger(__name__)

# ── MongoDB Connection ──

_mongo_client: AsyncIOMotorClient | None = None


def init_mongo_client() -> AsyncIOMotorClient:
    """Initialize the global MongoDB client (called during startup)."""
    global _mongo_client
    if _mongo_client is None:
        logger.info("Creating async MongoDB client connection")
        _mongo_client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _mongo_client


async def close_mongo_client() -> None:
    """Close the global MongoDB client (called during shutdown)."""
    global _mongo_client, _services
    if _mongo_client is not None:
        logger.info("Closing async MongoDB client connection")
        _mongo_client.close()
        _mongo_client = None
    _services = None


def get_mongo_client() -> AsyncIOMotorClient:
    """Get the global MongoDB client."""
    if _mongo_client is None:
        raise RuntimeError("MongoDB client not initialized. Call init_mongo_client first.")
    return _mongo_client


def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance."""
    client = get_mongo_client()
    return client.get_default_database()


# ── Service Getters ──

_services: dict[str, Any] | None = None


def get_services() -> dict[str, Any]:
    """Get all service instances for MCP tool handlers (cached singleton)."""
    global _services
    if _services is None:
        db = get_database()
        _services = {
            "video_summary_repo": MongoVideoSummaryRepository(db),
            "expansion_repo": MongoExpansionRepository(db),
            "llm_service": LLMService(LLMProvider()),
        }
    return _services
