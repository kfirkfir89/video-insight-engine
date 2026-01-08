"""vie-explainer MCP server entry point."""

import asyncio
import json

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from src.tools.explain_auto import explain_auto
from src.tools.explain_chat import explain_chat

# Create MCP server
server = Server("vie-explainer")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="explain_auto",
            description="Generate detailed documentation for a video section or concept. Results are cached and reused across all users.",
            inputSchema={
                "type": "object",
                "properties": {
                    "videoSummaryId": {
                        "type": "string",
                        "description": "ID of videoSummaryCache entry",
                    },
                    "targetType": {
                        "type": "string",
                        "enum": ["section", "concept"],
                        "description": "Type of content to explain",
                    },
                    "targetId": {
                        "type": "string",
                        "description": "UUID of the section or concept",
                    },
                },
                "required": ["videoSummaryId", "targetType", "targetId"],
            },
        ),
        Tool(
            name="explain_chat",
            description="Interactive conversation about a memorized item. Personalized per user, not cached.",
            inputSchema={
                "type": "object",
                "properties": {
                    "memorizedItemId": {
                        "type": "string",
                        "description": "ID of the memorized item",
                    },
                    "userId": {
                        "type": "string",
                        "description": "ID of the user",
                    },
                    "message": {
                        "type": "string",
                        "description": "User's message",
                    },
                    "chatId": {
                        "type": "string",
                        "description": "Optional - continue existing chat",
                    },
                },
                "required": ["memorizedItemId", "userId", "message"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls."""
    try:
        if name == "explain_auto":
            content = await explain_auto(
                video_summary_id=arguments["videoSummaryId"],
                target_type=arguments["targetType"],
                target_id=arguments["targetId"],
            )
            return [TextContent(type="text", text=content)]

        elif name == "explain_chat":
            result = await explain_chat(
                memorized_item_id=arguments["memorizedItemId"],
                user_id=arguments["userId"],
                message=arguments["message"],
                chat_id=arguments.get("chatId"),
            )
            return [TextContent(type="text", text=json.dumps(result))]

        else:
            return [TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]

    except ValueError as e:
        return [TextContent(type="text", text=json.dumps({"error": str(e)}))]
    except Exception as e:
        return [TextContent(type="text", text=json.dumps({"error": f"Internal error: {str(e)}"}))]


async def run_server():
    """Run the MCP server."""
    print("Starting vie-explainer MCP server...")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main():
    """Entry point for the MCP server."""
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
