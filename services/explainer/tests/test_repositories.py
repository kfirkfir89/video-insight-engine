"""Tests for MongoDB repository implementations."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from bson import ObjectId

from src.repositories.mongodb_repository import (
    MongoChatRepository,
    MongoExpansionRepository,
    MongoMemorizedItemRepository,
    MongoVideoSummaryRepository,
)
from src.schemas import Chat, Expansion, MemorizedItem, VideoSummary


def _utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class TestMongoVideoSummaryRepository:
    """Tests for MongoVideoSummaryRepository."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database."""
        db = MagicMock()
        db.videoSummaryCache = MagicMock()
        db.videoSummaryCache.find_one = AsyncMock()
        return db

    @pytest.fixture
    def repo(self, mock_db):
        """Create repository with mock database."""
        return MongoVideoSummaryRepository(mock_db)

    async def test_find_by_id_returns_video_summary(self, repo, mock_db):
        """Test finding existing video summary."""
        video_id = str(ObjectId())
        mock_doc = {
            "_id": ObjectId(video_id),
            "youtubeId": "abc123",
            "title": "Test Video",
            "summary": {
                "chapters": [
                    {
                        "id": "section-1",
                        "title": "Introduction",
                        "timestamp": "00:00",
                        "content": [
                            {"type": "paragraph", "text": "Test summary"},
                            {"type": "bullets", "items": ["Point 1"]},
                        ],
                    }
                ],
                "concepts": [
                    {
                        "id": "concept-1",
                        "name": "Test Concept",
                        "definition": "A test concept",
                    }
                ],
            },
        }
        mock_db.videoSummaryCache.find_one.return_value = mock_doc

        result = await repo.find_by_id(video_id)

        assert result is not None
        assert isinstance(result, VideoSummary)
        assert result.id == video_id
        assert result.youtubeId == "abc123"
        assert result.title == "Test Video"
        assert len(result.sections) == 1
        assert result.sections[0].title == "Introduction"
        assert len(result.concepts) == 1
        assert result.concepts[0].name == "Test Concept"

    async def test_find_by_id_returns_none_when_not_found(self, repo, mock_db):
        """Test returning None when video summary not found."""
        mock_db.videoSummaryCache.find_one.return_value = None

        result = await repo.find_by_id(str(ObjectId()))

        assert result is None

    async def test_find_by_id_returns_none_for_invalid_id(self, repo):
        """Test returning None for invalid ObjectId."""
        result = await repo.find_by_id("invalid-id")

        assert result is None


class TestMongoExpansionRepository:
    """Tests for MongoExpansionRepository."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database."""
        db = MagicMock()
        db.systemExpansionCache = MagicMock()
        db.systemExpansionCache.find_one = AsyncMock()
        db.systemExpansionCache.insert_one = AsyncMock()
        return db

    @pytest.fixture
    def repo(self, mock_db):
        """Create repository with mock database."""
        return MongoExpansionRepository(mock_db)

    async def test_find_by_target_returns_expansion(self, repo, mock_db):
        """Test finding cached expansion."""
        video_summary_id = str(ObjectId())
        expansion_id = ObjectId()
        now = _utc_now()
        mock_doc = {
            "_id": expansion_id,
            "videoSummaryId": ObjectId(video_summary_id),
            "targetType": "section",
            "targetId": "section-uuid-1",
            "context": {"title": "Test Section"},
            "content": "# Generated Content",
            "status": "completed",
            "version": 1,
            "model": "claude-3-sonnet",
            "generatedAt": now,
            "createdAt": now,
        }
        mock_db.systemExpansionCache.find_one.return_value = mock_doc

        result = await repo.find_by_target(video_summary_id, "section", "section-uuid-1")

        assert result is not None
        assert isinstance(result, Expansion)
        assert result.content == "# Generated Content"
        assert result.targetType == "section"
        assert result.targetId == "section-uuid-1"

    async def test_find_by_target_returns_none_when_not_found(self, repo, mock_db):
        """Test returning None when expansion not found."""
        mock_db.systemExpansionCache.find_one.return_value = None

        result = await repo.find_by_target(str(ObjectId()), "section", "nonexistent")

        assert result is None

    async def test_find_by_target_returns_none_for_invalid_id(self, repo):
        """Test returning None for invalid ObjectId."""
        result = await repo.find_by_target("invalid", "section", "uuid")

        assert result is None

    async def test_save_inserts_expansion(self, repo, mock_db):
        """Test saving new expansion."""
        inserted_id = ObjectId()
        mock_result = MagicMock()
        mock_result.inserted_id = inserted_id
        mock_db.systemExpansionCache.insert_one.return_value = mock_result

        video_summary_id = str(ObjectId())
        result = await repo.save(
            video_summary_id=video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
            context={"title": "Test Section"},
            content="# Generated Content",
            model="claude-3-sonnet",
        )

        assert result == str(inserted_id)
        mock_db.systemExpansionCache.insert_one.assert_called_once()

        # Verify document structure
        call_args = mock_db.systemExpansionCache.insert_one.call_args[0][0]
        assert call_args["targetType"] == "section"
        assert call_args["targetId"] == "section-uuid-1"
        assert call_args["content"] == "# Generated Content"
        assert call_args["status"] == "completed"
        assert call_args["version"] == 1
        assert call_args["model"] == "claude-3-sonnet"


class TestMongoMemorizedItemRepository:
    """Tests for MongoMemorizedItemRepository."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database."""
        db = MagicMock()
        db.memorizedItems = MagicMock()
        db.memorizedItems.find_one = AsyncMock()
        return db

    @pytest.fixture
    def repo(self, mock_db):
        """Create repository with mock database."""
        return MongoMemorizedItemRepository(mock_db)

    async def test_find_by_id_and_user_returns_item(self, repo, mock_db):
        """Test finding memorized item for user."""
        item_id = str(ObjectId())
        user_id = str(ObjectId())
        now = _utc_now()
        mock_doc = {
            "_id": ObjectId(item_id),
            "userId": ObjectId(user_id),
            "title": "Saved Content",
            "source": {
                "videoTitle": "Test Video",
                "youtubeUrl": "https://youtube.com/watch?v=abc123",
                "content": {"sections": []},
            },
            "notes": "My notes",
            "createdAt": now,
            "updatedAt": now,
        }
        mock_db.memorizedItems.find_one.return_value = mock_doc

        result = await repo.find_by_id_and_user(item_id, user_id)

        assert result is not None
        assert isinstance(result, MemorizedItem)
        assert result.id == item_id
        assert result.userId == user_id
        assert result.title == "Saved Content"
        assert result.source.videoTitle == "Test Video"
        assert result.notes == "My notes"

    async def test_find_by_id_and_user_returns_none_when_not_found(self, repo, mock_db):
        """Test returning None when item not found."""
        mock_db.memorizedItems.find_one.return_value = None

        result = await repo.find_by_id_and_user(str(ObjectId()), str(ObjectId()))

        assert result is None

    async def test_find_by_id_and_user_returns_none_for_invalid_item_id(self, repo):
        """Test returning None for invalid item ObjectId."""
        result = await repo.find_by_id_and_user("invalid", str(ObjectId()))

        assert result is None

    async def test_find_by_id_and_user_returns_none_for_invalid_user_id(self, repo):
        """Test returning None for invalid user ObjectId."""
        result = await repo.find_by_id_and_user(str(ObjectId()), "invalid")

        assert result is None


class TestMongoChatRepository:
    """Tests for MongoChatRepository."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database."""
        db = MagicMock()
        db.userChats = MagicMock()
        db.userChats.find_one = AsyncMock()
        db.userChats.insert_one = AsyncMock()
        db.userChats.update_one = AsyncMock()
        return db

    @pytest.fixture
    def repo(self, mock_db):
        """Create repository with mock database."""
        return MongoChatRepository(mock_db)

    async def test_find_by_id_and_user_returns_chat(self, repo, mock_db):
        """Test finding chat for user."""
        chat_id = str(ObjectId())
        user_id = str(ObjectId())
        item_id = str(ObjectId())
        now = _utc_now()
        mock_doc = {
            "_id": ObjectId(chat_id),
            "userId": ObjectId(user_id),
            "memorizedItemId": ObjectId(item_id),
            "messages": [
                {"role": "user", "content": "Hello", "createdAt": now},
                {"role": "assistant", "content": "Hi there!", "createdAt": now},
            ],
            "title": None,
            "createdAt": now,
            "updatedAt": now,
        }
        mock_db.userChats.find_one.return_value = mock_doc

        result = await repo.find_by_id_and_user(chat_id, user_id)

        assert result is not None
        assert isinstance(result, Chat)
        assert result.id == chat_id
        assert result.userId == user_id
        assert len(result.messages) == 2
        assert result.messages[0].role == "user"
        assert result.messages[0].content == "Hello"

    async def test_find_by_id_and_user_returns_none_when_not_found(self, repo, mock_db):
        """Test returning None when chat not found."""
        mock_db.userChats.find_one.return_value = None

        result = await repo.find_by_id_and_user(str(ObjectId()), str(ObjectId()))

        assert result is None

    async def test_find_by_id_and_user_returns_none_for_invalid_ids(self, repo):
        """Test returning None for invalid ObjectIds."""
        result = await repo.find_by_id_and_user("invalid", str(ObjectId()))
        assert result is None

        result = await repo.find_by_id_and_user(str(ObjectId()), "invalid")
        assert result is None

    async def test_create_inserts_chat(self, repo, mock_db):
        """Test creating new chat."""
        inserted_id = ObjectId()
        mock_result = MagicMock()
        mock_result.inserted_id = inserted_id
        mock_db.userChats.insert_one.return_value = mock_result

        user_id = str(ObjectId())
        item_id = str(ObjectId())

        result = await repo.create(user_id, item_id)

        assert result == str(inserted_id)
        mock_db.userChats.insert_one.assert_called_once()

        # Verify document structure
        call_args = mock_db.userChats.insert_one.call_args[0][0]
        assert call_args["userId"] == ObjectId(user_id)
        assert call_args["memorizedItemId"] == ObjectId(item_id)
        assert call_args["messages"] == []
        assert call_args["title"] is None

    async def test_add_messages_updates_chat(self, repo, mock_db):
        """Test adding messages to chat."""
        chat_id = str(ObjectId())
        now = _utc_now()
        messages = [
            {"role": "user", "content": "Hello", "createdAt": now},
            {"role": "assistant", "content": "Hi!", "createdAt": now},
        ]

        await repo.add_messages(chat_id, messages)

        mock_db.userChats.update_one.assert_called_once()

        # Verify update structure
        call_args = mock_db.userChats.update_one.call_args
        filter_arg = call_args[0][0]
        update_arg = call_args[0][1]

        assert filter_arg["_id"] == ObjectId(chat_id)
        assert "$push" in update_arg
        assert update_arg["$push"]["messages"]["$each"] == messages
        assert "$set" in update_arg
        assert "updatedAt" in update_arg["$set"]
