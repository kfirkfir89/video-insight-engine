"""FastAPI dependency injection setup."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pymongo import MongoClient
from pymongo.database import Database
import anthropic

from src.config import settings
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService


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
def get_anthropic_client() -> anthropic.Anthropic:
    """Create and cache Anthropic client."""
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def get_llm_service(
    client: Annotated[anthropic.Anthropic, Depends(get_anthropic_client)]
) -> LLMService:
    """Get LLM service instance with injected client."""
    return LLMService(client)


# Type aliases for cleaner dependency injection
VideoRepositoryDep = Annotated[MongoDBVideoRepository, Depends(get_video_repository)]
AnthropicClientDep = Annotated[anthropic.Anthropic, Depends(get_anthropic_client)]
LLMServiceDep = Annotated[LLMService, Depends(get_llm_service)]
DatabaseDep = Annotated[Database, Depends(get_database)]
