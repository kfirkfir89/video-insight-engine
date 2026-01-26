"""FastAPI dependency injection setup."""

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pymongo import MongoClient
from pymongo.database import Database

from src.config import settings, MODEL_MAP
from src.models.schemas import ProviderConfig
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService
from src.services.llm_provider import LLMProvider
from src.services.usage_tracker import UsageTracker

logger = logging.getLogger(__name__)


@lru_cache()
def get_mongo_client() -> MongoClient:
    """Create and cache MongoDB client."""
    return MongoClient(settings.MONGODB_URI)


def get_database(
    client: Annotated[MongoClient, Depends(get_mongo_client)]
) -> Database:
    """Get MongoDB database instance."""
    return client.get_default_database()


def get_video_repository(
    database: Annotated[Database, Depends(get_database)]
) -> MongoDBVideoRepository:
    """Get video repository instance."""
    return MongoDBVideoRepository(database)


@lru_cache()
def get_llm_provider() -> LLMProvider:
    """Create and cache LLM provider (multi-provider support via LiteLLM)."""
    return LLMProvider()


def create_llm_provider(providers: ProviderConfig | None = None) -> LLMProvider:
    """
    Factory function to create LLMProvider with optional provider override.

    Used by dev tools to test different LLM providers without code changes.
    If no providers specified, returns the cached default provider.
    """
    if providers is None:
        return get_llm_provider()

    # Resolve provider name to model string via MODEL_MAP
    default_model = MODEL_MAP.get(providers.default, {}).get(
        "default", MODEL_MAP["anthropic"]["default"]
    )

    fallback_models = None
    if providers.fallback:
        fallback_model = MODEL_MAP.get(providers.fallback, {}).get(
            "default", MODEL_MAP["anthropic"]["default"]
        )
        fallback_models = [fallback_model]

    logger.info(
        f"Creating custom LLMProvider: model={default_model}, fallback={fallback_models}"
    )

    return LLMProvider(
        model=default_model,
        fallback_models=fallback_models,
    )


def get_llm_service(
    provider: Annotated[LLMProvider, Depends(get_llm_provider)]
) -> LLMService:
    """Get LLM service instance with injected provider."""
    return LLMService(provider)


def get_usage_tracker(
    database: Annotated[Database, Depends(get_database)]
) -> UsageTracker:
    """Get usage tracker instance for cost monitoring."""
    return UsageTracker(database)


# Type aliases for cleaner dependency injection
VideoRepositoryDep = Annotated[MongoDBVideoRepository, Depends(get_video_repository)]
LLMProviderDep = Annotated[LLMProvider, Depends(get_llm_provider)]
LLMServiceDep = Annotated[LLMService, Depends(get_llm_service)]
DatabaseDep = Annotated[Database, Depends(get_database)]
UsageTrackerDep = Annotated[UsageTracker, Depends(get_usage_tracker)]
