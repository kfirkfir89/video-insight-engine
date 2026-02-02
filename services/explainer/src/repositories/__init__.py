"""Repository layer for vie-explainer service."""

from src.repositories.base import (
    ChatRepositoryProtocol,
    ExpansionRepositoryProtocol,
    MemorizedItemRepositoryProtocol,
    VideoSummaryRepositoryProtocol,
)
from src.repositories.mongodb_repository import (
    MongoChatRepository,
    MongoExpansionRepository,
    MongoMemorizedItemRepository,
    MongoVideoSummaryRepository,
)

__all__ = [
    # Protocols
    "VideoSummaryRepositoryProtocol",
    "ExpansionRepositoryProtocol",
    "MemorizedItemRepositoryProtocol",
    "ChatRepositoryProtocol",
    # Implementations
    "MongoVideoSummaryRepository",
    "MongoExpansionRepository",
    "MongoMemorizedItemRepository",
    "MongoChatRepository",
]
