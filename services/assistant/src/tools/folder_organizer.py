"""Folder organizer tool — folder CRUD + video moves via vie-api.

A single tool fronts all folder/video-move actions (``create_folder``,
``rename_folder``, ``move_folder``, ``delete_folder``, ``move_video``). The
dispatcher injects the originating ``action`` into the context; this tool
branches on it to the matching :class:`ApiClient` method. Ownership is enforced
upstream in vie-api — this tool only forwards the user-scoped request.
"""

from __future__ import annotations

from src.exceptions import ValidationError
from src.logging_config import get_logger
from src.services.api_client import ApiClient

logger = get_logger(__name__)


class FolderOrganizerTool:
    """Create, rename, move, or delete folders, and move videos between them."""

    name = "folder_organizer"
    description = "Manage library folders and move videos between them"

    def __init__(self, api_client: ApiClient) -> None:
        self._api = api_client

    async def execute(self, params: dict, context: dict) -> dict:
        """Dispatch to the right vie-api call based on ``context['action']``.

        Args:
            params: Action-specific fields (``name``, ``folder_id``,
                ``parent_id``, ``video_id``, ``delete_content``).
            context: Must contain ``user_id`` and ``action``.

        Returns:
            Dict describing the mutation result.

        Raises:
            ValidationError: When ``user_id`` is missing or required
                params for the action are absent.
        """
        user_id = context.get("user_id")
        if not user_id:
            raise ValidationError("folder_organizer requires an authenticated user")

        action = context.get("action")
        logger.info("folder_organizer_dispatch", action=action, user_id=user_id)

        if action == "create_folder":
            return await self._create_folder(user_id, params)
        if action == "rename_folder":
            return await self._rename_folder(user_id, params)
        if action == "move_folder":
            return await self._move_folder(user_id, params)
        if action == "delete_folder":
            return await self._delete_folder(user_id, params)
        if action == "move_video":
            return await self._move_video(user_id, params)
        raise ValidationError(f"folder_organizer cannot handle action: {action}")

    async def _create_folder(self, user_id: str, params: dict) -> dict:
        name = _require(params, "name", "create_folder")
        folder = await self._api.create_folder(
            user_id,
            name,
            color=params.get("color"),
            icon=params.get("icon"),
            parentId=params.get("parent_id"),
        )
        return {"created": True, "folder": folder}

    async def _rename_folder(self, user_id: str, params: dict) -> dict:
        folder_id = _require(params, "folder_id", "rename_folder")
        name = _require(params, "name", "rename_folder")
        folder = await self._api.update_folder(user_id, folder_id, name=name)
        return {"renamed": True, "folder": folder}

    async def _move_folder(self, user_id: str, params: dict) -> dict:
        folder_id = _require(params, "folder_id", "move_folder")
        # ``parent_id`` absent/None means "move to the top level" — forwarded as
        # an explicit null so vie-api doesn't treat it as "leave unchanged".
        folder = await self._api.move_folder(
            user_id, folder_id, params.get("parent_id")
        )
        return {"moved": True, "folder": folder}

    async def _delete_folder(self, user_id: str, params: dict) -> dict:
        folder_id = _require(params, "folder_id", "delete_folder")
        delete_content = bool(params.get("delete_content", False))
        result = await self._api.delete_folder(
            user_id, folder_id, delete_content=delete_content
        )
        return {"deleted": True, "result": result}

    async def _move_video(self, user_id: str, params: dict) -> dict:
        video_id = _require(params, "video_id", "move_video")
        folder_id = _require(params, "folder_id", "move_video")
        result = await self._api.move_video(user_id, video_id, folder_id)
        return {"moved": True, "result": result}


def _require(params: dict, key: str, action: str) -> str:
    """Return a non-empty string param or raise ValidationError."""
    value = params.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValidationError(f"Action '{action}' requires param '{key}'")
    return str(value)
