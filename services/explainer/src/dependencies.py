"""FastAPI dependency injection providers for vie-explainer service.

This module provides all dependencies using FastAPI's Depends() pattern,
enabling easy testing through dependency overrides.
"""

from typing import Annotated

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from src.config import settings
from src.logging_config import get_logger
from src.repositories import (
    MongoChatRepository,
    MongoExpansionRepository,
    MongoMemorizedItemRepository,
    MongoVideoSummaryRepository,
)
from src.repositories.base import (
    ChatRepositoryProtocol,
    ExpansionRepositoryProtocol,
    MemorizedItemRepositoryProtocol,
    VideoSummaryRepositoryProtocol,
)
from src.services.llm import LLMService
from src.services.llm_provider import LLMProvider

logger = get_logger(__name__)


# ============================================================
# MongoDB Connection
# ============================================================

# Global client managed via lifespan events
_mongo_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    """Get the global MongoDB client.

    The client is created during app startup and closed during shutdown.
    See lifespan handler in main.py.
    """
    if _mongo_client is None:
        raise RuntimeError("MongoDB client not initialized. Call init_mongo_client first.")
    return _mongo_client


def init_mongo_client() -> AsyncIOMotorClient:
    """Initialize the global MongoDB client (called during startup)."""
    global _mongo_client
    if _mongo_client is None:
        logger.info("Creating async MongoDB client connection")
        _mongo_client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _mongo_client


async def close_mongo_client() -> None:
    """Close the global MongoDB client (called during shutdown)."""
    global _mongo_client
    if _mongo_client is not None:
        logger.info("Closing async MongoDB client connection")
        _mongo_client.close()
        _mongo_client = None


def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance."""
    client = get_mongo_client()
    return client.get_default_database()


# ============================================================
# Repository Dependencies
# ============================================================


def get_video_summary_repo(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> MongoVideoSummaryRepository:
    """Get video summary repository instance."""
    return MongoVideoSummaryRepository(db)


def get_expansion_repo(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> MongoExpansionRepository:
    """Get expansion repository instance."""
    return MongoExpansionRepository(db)


def get_memorized_item_repo(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> MongoMemorizedItemRepository:
    """Get memorized item repository instance."""
    return MongoMemorizedItemRepository(db)


def get_chat_repo(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> MongoChatRepository:
    """Get chat repository instance."""
    return MongoChatRepository(db)


# ============================================================
# LLM Service Dependencies
# ============================================================


def get_llm_provider() -> LLMProvider:
    """Get LLM provider instance."""
    return LLMProvider()


def get_llm_service(
    provider: Annotated[LLMProvider, Depends(get_llm_provider)],
) -> LLMService:
    """Get LLM service instance."""
    return LLMService(provider)


# ============================================================
# Type Aliases for Route Signatures
# ============================================================

VideoSummaryRepoDep = Annotated[VideoSummaryRepositoryProtocol, Depends(get_video_summary_repo)]
ExpansionRepoDep = Annotated[ExpansionRepositoryProtocol, Depends(get_expansion_repo)]
MemorizedItemRepoDep = Annotated[MemorizedItemRepositoryProtocol, Depends(get_memorized_item_repo)]
ChatRepoDep = Annotated[ChatRepositoryProtocol, Depends(get_chat_repo)]
LLMServiceDep = Annotated[LLMService, Depends(get_llm_service)]
