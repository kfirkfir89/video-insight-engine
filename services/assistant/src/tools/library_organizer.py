"""Library organizer tool — LLM-proposed folder buckets, applied via vie-api.

Reads the user's videos and existing folders, asks the LLM to propose a small
set of thematic folders with the videos that belong in each, then creates each
folder and moves its videos. Ownership and cost concerns live in vie-api; this
tool only orchestrates the proposal and the resulting mutations.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from src.exceptions import LLMError, ValidationError
from src.logging_config import get_logger
from src.services.api_client import ApiClient
from src.services.llm_provider import LLMProvider

logger = get_logger(__name__)

_ORGANIZE_SYSTEM_PROMPT = """\
You are a librarian organizing a user's saved videos into thematic folders.

Existing folders:
{folders}

Videos to organize (id — title):
{videos}

Propose a small number of clear, non-overlapping folders. Group related
videos together. Only reference video ids from the list above.

Respond with ONLY valid JSON in this exact format:
{{
  "folders": [
    {{"name": "Folder name", "videoIds": ["id1", "id2"]}}
  ]
}}"""

_MAX_VIDEOS = 200
# Cap concurrent move_video calls so a 200-video reorg can't open 200 sockets
# to vie-api at once.
_MOVE_CONCURRENCY = 8


class LibraryOrganizerTool:
    """Auto-organize the user's library into LLM-proposed folders."""

    name = "library_organizer"
    description = "Group the user's videos into thematic folders automatically"

    def __init__(self, api_client: ApiClient, llm: LLMProvider) -> None:
        self._api = api_client
        self._llm = llm

    async def execute(self, params: dict, context: dict) -> dict:
        """Propose folder buckets and apply them.

        Args:
            params: Unused (kept for the BaseTool signature).
            context: Must contain ``user_id``.

        Returns:
            Dict with ``folders_created`` and ``videos_moved`` counts.

        Raises:
            ValidationError: When ``user_id`` is missing.
        """
        user_id = context.get("user_id")
        if not user_id:
            raise ValidationError("library_organizer requires an authenticated user")

        videos = _as_list(await self._api.list_videos(user_id))
        folders = _as_list(await self._api.list_folders(user_id))
        logger.info(
            "library_organizer_start",
            user_id=user_id,
            video_count=len(videos),
            folder_count=len(folders),
        )

        if not videos:
            return {"folders_created": 0, "videos_moved": 0}

        proposal = await self._propose_folders(videos, folders)
        return await self._apply_proposal(user_id, proposal, videos)

    async def _propose_folders(
        self, videos: list[dict], folders: list[dict]
    ) -> list[dict]:
        """Ask the LLM for a {folders:[{name,videoIds}]} proposal."""
        system_prompt = _ORGANIZE_SYSTEM_PROMPT.format(
            folders=_format_folders(folders),
            videos=_format_videos(videos),
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Propose the folder organization now."},
        ]
        try:
            raw = await self._llm.complete_with_messages(
                messages=messages,
                max_tokens=2000,
                span_name="tool:library_organizer",
            )
        except LLMError:
            logger.exception("library_organizer_llm_failed")
            raise
        return _parse_proposal(raw)

    async def _apply_proposal(
        self, user_id: str, proposal: list[dict], videos: list[dict]
    ) -> dict:
        """Create each proposed folder and move its videos into it."""
        valid_ids = {_video_id(v) for v in videos} - {""}
        sem = asyncio.Semaphore(_MOVE_CONCURRENCY)
        folders_created = 0
        videos_moved = 0

        for bucket in proposal:
            name = bucket.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            video_ids = [
                vid
                for vid in bucket.get("videoIds", [])
                if isinstance(vid, str) and vid in valid_ids
            ]
            if not video_ids:
                continue

            folder = await self._api.create_folder(user_id, name.strip())
            folders_created += 1
            folder_id = _folder_id(folder)
            if not folder_id:
                logger.warning("library_organizer_no_folder_id", name=name)
                continue
            videos_moved += await self._move_videos(
                user_id, folder_id, video_ids, sem
            )

        logger.info(
            "library_organizer_complete",
            user_id=user_id,
            folders_created=folders_created,
            videos_moved=videos_moved,
        )
        return {"folders_created": folders_created, "videos_moved": videos_moved}

    async def _move_videos(
        self,
        user_id: str,
        folder_id: str,
        video_ids: list[str],
        sem: asyncio.Semaphore,
    ) -> int:
        """Move all *video_ids* into *folder_id* concurrently; return the count moved.

        Moves are independent, so they run in parallel (bounded by *sem*). A
        single failed move is logged and skipped rather than aborting the whole
        reorganization.
        """

        async def _move_one(video_id: str) -> bool:
            async with sem:
                try:
                    await self._api.move_video(user_id, video_id, folder_id)
                    return True
                except Exception as exc:  # noqa: BLE001 — best-effort per video
                    logger.warning(
                        "library_organizer_move_failed",
                        video_id=video_id,
                        folder_id=folder_id,
                        error=str(exc),
                    )
                    return False

        results = await asyncio.gather(*(_move_one(vid) for vid in video_ids))
        return sum(results)


def _as_list(value: Any) -> list[dict]:
    """Coerce an api response into a list of dicts (tolerates None/dict-wrapped)."""
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, dict):
        for key in ("items", "videos", "folders", "data"):
            inner = value.get(key)
            if isinstance(inner, list):
                return [v for v in inner if isinstance(v, dict)]
    return []


def _video_id(video: dict) -> str:
    """The userVideo id used to MOVE a video — a Mongo ObjectId string.

    Must be the userVideo ``_id`` (what ``PATCH /internal/assistant/videos/:id/move``
    expects), NOT the youtubeId — a youtubeId fails the route's ObjectId validation.
    """
    return str(video.get("id") or video.get("_id") or "")


def _folder_id(folder: Any) -> str:
    """Best-effort folder id extraction from a create_folder response."""
    if isinstance(folder, dict):
        return str(folder.get("id") or folder.get("_id") or "")
    return ""


def _format_videos(videos: list[dict]) -> str:
    """Render the video list for the prompt (capped)."""
    lines = [
        f"{_video_id(v)} — {v.get('title', 'Untitled')}"
        for v in videos[:_MAX_VIDEOS]
    ]
    return "\n".join(lines) or "(none)"


def _format_folders(folders: list[dict]) -> str:
    """Render existing folder names for the prompt."""
    names = [str(f.get("name", "")) for f in folders if f.get("name")]
    return ", ".join(names) or "(none)"


def _parse_proposal(raw: str) -> list[dict]:
    """Parse the LLM JSON into a list of folder buckets.

    The model frequently wraps its JSON in a ```json ... ``` markdown fence (and
    may add surrounding prose), so carve out the outermost JSON object before
    parsing rather than calling ``json.loads`` on the raw reply.
    """
    try:
        data = json.loads(_extract_json_object(raw))
        folders = data.get("folders", [])
        return [f for f in folders if isinstance(f, dict)]
    except (json.JSONDecodeError, AttributeError, TypeError):
        logger.warning("library_organizer_parse_failed", raw_preview=raw[:200])
        return []


def _extract_json_object(raw: str) -> str:
    """Carve the outermost ``{...}`` object out of an LLM reply.

    Tolerates ```json fences and surrounding prose by slicing from the first
    ``{`` to the last ``}``.
    """
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        return raw[start : end + 1]
    return raw
