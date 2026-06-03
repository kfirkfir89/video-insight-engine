"""Agent tool schemas + dispatcher for the library-chat agentic loop.

Exposes the user's folder/video operations as LLM function-calling tools. The
LLM picks a tool and supplies arguments; :func:`execute_tool` dispatches to the
matching :class:`~src.services.api_client.ApiClient` method, ALWAYS injecting
``user_id`` server-side (never trusting an id from the model). vie-api enforces
ownership and cost gates at the data layer — this module only wires the call.

Ids (``folder_id``/``video_id``) are resolved by the model calling
``list_folders``/``list_videos`` first; ``video_id`` is the userVideo ``id``
field, NOT the YouTube id.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from src.logging_config import get_logger
from src.tools.library_organizer import LibraryOrganizerTool

if TYPE_CHECKING:
    from src.services.api_client import ApiClient
    from src.services.llm_provider import LLMProvider

logger = get_logger(__name__)

# ─── Tool schemas (OpenAI function-calling format) ──────────────────────────

_ID_SOURCE_NOTE = (
    "ids come from list_folders/list_videos results; video_id is the userVideo "
    "`id` field (NOT the YouTube id). The user owns these — call the list tools "
    "first to resolve ids."
)

AGENT_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_folders",
            "description": (
                "List the user's folders (id, name, parentId). Call this to "
                "resolve a folder_id before renaming/moving/deleting a folder "
                "or moving a video into one."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_videos",
            "description": (
                "List the user's saved videos (id, title, folderId). Call this "
                "to resolve a video_id by its TITLE before moving a video. "
                "video_id is the userVideo `id` field, NOT the YouTube id."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_folder",
            "description": f"Create a new folder for the user. {_ID_SOURCE_NOTE}",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Folder name."},
                    "parent_id": {
                        "type": "string",
                        "description": "Optional parent folder id (nest under it).",
                    },
                    "color": {"type": "string", "description": "Optional color."},
                    "icon": {"type": "string", "description": "Optional icon."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rename_folder",
            "description": f"Rename an existing folder. {_ID_SOURCE_NOTE}",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_id": {"type": "string", "description": "Folder id to rename."},
                    "name": {"type": "string", "description": "New folder name."},
                },
                "required": ["folder_id", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_folder",
            "description": (
                "Move a folder under another folder, or to the top level when "
                f"parent_id is omitted. {_ID_SOURCE_NOTE}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_id": {"type": "string", "description": "Folder id to move."},
                    "parent_id": {
                        "type": "string",
                        "description": "New parent folder id; omit to move to root.",
                    },
                },
                "required": ["folder_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_folder",
            "description": (
                "Delete a folder. When delete_content is true its videos are "
                "deleted too (destructive — confirm with the user first). "
                f"{_ID_SOURCE_NOTE}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_id": {"type": "string", "description": "Folder id to delete."},
                    "delete_content": {
                        "type": "boolean",
                        "description": "Also delete the folder's videos (destructive).",
                    },
                },
                "required": ["folder_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_video",
            "description": f"Move a video into a folder. {_ID_SOURCE_NOTE}",
            "parameters": {
                "type": "object",
                "properties": {
                    "video_id": {
                        "type": "string",
                        "description": "userVideo id to move (NOT the YouTube id).",
                    },
                    "folder_id": {"type": "string", "description": "Destination folder id."},
                },
                "required": ["video_id", "folder_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_video",
            "description": (
                "Start generating a knowledge app from a YouTube URL. This costs "
                "the user money — confirm with the user before calling. Optionally "
                f"drop it in a folder. {_ID_SOURCE_NOTE}"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "YouTube video URL."},
                    "folder_id": {
                        "type": "string",
                        "description": "Optional destination folder id.",
                    },
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "organize_library",
            "description": (
                "Auto-organize the user's whole library into thematic folders and "
                "move videos into them. Use when the user asks to tidy/organize "
                "everything rather than a single move."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


async def execute_tool(
    name: str,
    args: dict[str, Any],
    *,
    user_id: str,
    api_client: ApiClient,
    llm: LLMProvider,
) -> dict[str, Any]:
    """Dispatch a tool call to the matching api_client method.

    ``user_id`` is ALWAYS injected server-side and never read from *args*.
    Unknown tool names or bad argument shapes return ``{"error": ...}`` so the
    model can self-correct on the next loop iteration instead of crashing.

    Args:
        name: Tool name from the model's function call.
        args: Parsed arguments dict supplied by the model.
        user_id: Authenticated user id (injected into every call).
        api_client: vie-api client for folder/video mutations.
        llm: LLM provider (needed by organize_library).

    Returns:
        A compact result dict (e.g. ``{"ok": True, "folder": {...}}``) or
        ``{"error": "..."}``.
    """
    try:
        return await _dispatch(name, args, user_id=user_id, api_client=api_client, llm=llm)
    except KeyError as exc:
        return {"error": f"missing required argument: {exc}"}
    except (TypeError, ValueError) as exc:
        logger.warning("agent_tool_bad_args", tool=name, error=str(exc))
        return {"error": f"invalid arguments for {name}: {exc}"}
    except Exception as exc:  # noqa: BLE001 — surface as model-correctable error
        logger.warning("agent_tool_failed", tool=name, error=str(exc))
        return {"error": f"tool {name} failed: {exc}"}


async def _dispatch(
    name: str,
    args: dict[str, Any],
    *,
    user_id: str,
    api_client: ApiClient,
    llm: LLMProvider,
) -> dict[str, Any]:
    """Route a single tool name to its api_client method (no error wrapping)."""
    if name == "list_folders":
        return {"ok": True, "folders": await api_client.list_folders(user_id)}
    if name == "list_videos":
        return {"ok": True, "videos": await api_client.list_videos(user_id)}
    if name == "create_folder":
        folder = await api_client.create_folder(
            user_id,
            args["name"],
            parentId=args.get("parent_id"),
            color=args.get("color"),
            icon=args.get("icon"),
        )
        return {"ok": True, "folder": folder}
    if name == "rename_folder":
        folder = await api_client.update_folder(
            user_id, args["folder_id"], name=args["name"]
        )
        return {"ok": True, "folder": folder}
    if name == "move_folder":
        folder = await api_client.move_folder(
            user_id, args["folder_id"], args.get("parent_id")
        )
        return {"ok": True, "folder": folder}
    if name == "delete_folder":
        result = await api_client.delete_folder(
            user_id, args["folder_id"], bool(args.get("delete_content", False))
        )
        return {"ok": True, "result": result}
    if name == "move_video":
        result = await api_client.move_video(
            user_id, args["video_id"], args["folder_id"]
        )
        return {"ok": True, "result": result}
    if name == "generate_video":
        result = await api_client.generate_video(
            user_id, args["url"], args.get("folder_id")
        )
        return {"ok": True, "result": result}
    if name == "organize_library":
        result = await LibraryOrganizerTool(api_client, llm).execute(
            {}, {"user_id": user_id}
        )
        return {"ok": True, "result": result}
    return {"error": f"unknown tool: {name}"}
