"""Dependency management for vie-admin service."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from src.config import settings

_mongo_client: AsyncIOMotorClient | None = None


def init_mongo_client() -> AsyncIOMotorClient:
    """Initialize the global MongoDB client."""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _mongo_client


async def close_mongo_client() -> None:
    """Close the global MongoDB client."""
    global _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None


def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance."""
    if _mongo_client is None:
        raise RuntimeError("MongoDB client not initialized")
    return _mongo_client.get_default_database()
