"""Tests for MongoDB service."""

import pytest
from unittest.mock import patch, MagicMock
from bson import ObjectId

from src.services.mongodb import (
    get_video_summary,
    get_expansion,
    save_expansion,
    get_memorized_item,
    get_chat,
    create_chat,
    add_messages,
)


class TestVideoSummaryCache:
    """Tests for video summary cache operations."""

    @patch("src.services.mongodb.get_database")
    def test_get_video_summary_found(self, mock_get_db):
        """Test getting existing video summary."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        expected = {"_id": ObjectId(), "title": "Test Video"}
        mock_db.videoSummaryCache.find_one.return_value = expected

        result = get_video_summary(str(ObjectId()))

        assert result == expected
        mock_db.videoSummaryCache.find_one.assert_called_once()

    @patch("src.services.mongodb.get_database")
    def test_get_video_summary_not_found(self, mock_get_db):
        """Test getting non-existent video summary."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.videoSummaryCache.find_one.return_value = None

        result = get_video_summary(str(ObjectId()))

        assert result is None


class TestSystemExpansionCache:
    """Tests for expansion cache operations."""

    @patch("src.services.mongodb.get_database")
    def test_get_expansion_found(self, mock_get_db):
        """Test getting cached expansion."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        expected = {"content": "Cached content", "status": "completed"}
        mock_db.systemExpansionCache.find_one.return_value = expected

        result = get_expansion(
            video_summary_id=str(ObjectId()),
            target_type="section",
            target_id="section-uuid-1",
        )

        assert result == expected
        mock_db.systemExpansionCache.find_one.assert_called_once()

    @patch("src.services.mongodb.get_database")
    def test_get_expansion_not_found(self, mock_get_db):
        """Test getting non-existent expansion."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.systemExpansionCache.find_one.return_value = None

        result = get_expansion(
            video_summary_id=str(ObjectId()),
            target_type="section",
            target_id="section-uuid-1",
        )

        assert result is None

    @patch("src.services.mongodb.get_database")
    def test_save_expansion(self, mock_get_db):
        """Test saving expansion."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_result = MagicMock()
        mock_result.inserted_id = ObjectId()
        mock_db.systemExpansionCache.insert_one.return_value = mock_result

        video_summary_id = str(ObjectId())
        result = save_expansion(
            video_summary_id=video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
            context={"title": "Test Section"},
            content="# Generated Content",
            model="claude-3-sonnet",
        )

        assert result == str(mock_result.inserted_id)
        mock_db.systemExpansionCache.insert_one.assert_called_once()

        # Verify document structure
        call_args = mock_db.systemExpansionCache.insert_one.call_args[0][0]
        assert call_args["targetType"] == "section"
        assert call_args["targetId"] == "section-uuid-1"
        assert call_args["content"] == "# Generated Content"
        assert call_args["status"] == "completed"
        assert call_args["model"] == "claude-3-sonnet"


class TestMemorizedItems:
    """Tests for memorized items operations."""

    @patch("src.services.mongodb.get_database")
    def test_get_memorized_item_found(self, mock_get_db):
        """Test getting memorized item with correct user."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        user_id = ObjectId()
        expected = {"_id": ObjectId(), "userId": user_id, "title": "Saved Item"}
        mock_db.memorizedItems.find_one.return_value = expected

        result = get_memorized_item(str(ObjectId()), str(user_id))

        assert result == expected

    @patch("src.services.mongodb.get_database")
    def test_get_memorized_item_not_found(self, mock_get_db):
        """Test getting non-existent memorized item."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.memorizedItems.find_one.return_value = None

        result = get_memorized_item(str(ObjectId()), str(ObjectId()))

        assert result is None


class TestUserChats:
    """Tests for user chats operations."""

    @patch("src.services.mongodb.get_database")
    def test_get_chat_found(self, mock_get_db):
        """Test getting existing chat."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        expected = {"_id": ObjectId(), "messages": []}
        mock_db.userChats.find_one.return_value = expected

        result = get_chat(str(ObjectId()), str(ObjectId()))

        assert result == expected

    @patch("src.services.mongodb.get_database")
    def test_create_chat(self, mock_get_db):
        """Test creating new chat."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_result = MagicMock()
        mock_result.inserted_id = ObjectId()
        mock_db.userChats.insert_one.return_value = mock_result

        user_id = str(ObjectId())
        item_id = str(ObjectId())

        result = create_chat(user_id, item_id)

        assert result == str(mock_result.inserted_id)
        mock_db.userChats.insert_one.assert_called_once()

        # Verify document structure
        call_args = mock_db.userChats.insert_one.call_args[0][0]
        assert call_args["messages"] == []
        assert call_args["title"] is None

    @patch("src.services.mongodb.get_database")
    def test_add_messages(self, mock_get_db):
        """Test adding messages to chat."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        chat_id = str(ObjectId())
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"},
        ]

        add_messages(chat_id, messages)

        mock_db.userChats.update_one.assert_called_once()

        # Verify update structure
        call_args = mock_db.userChats.update_one.call_args
        update = call_args[0][1]
        assert "$push" in update
        assert update["$push"]["messages"]["$each"] == messages
        assert "$set" in update
        assert "updatedAt" in update["$set"]
