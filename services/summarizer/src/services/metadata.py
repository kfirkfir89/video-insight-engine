import httpx


async def get_video_metadata(video_id: str) -> dict:
    """Fetch video metadata from YouTube oEmbed API."""
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            return {
                "title": data.get("title", "Unknown Title"),
                "channel": data.get("author_name"),
                "thumbnail_url": data.get("thumbnail_url"),
            }
        except Exception:
            return {
                "title": "Unknown Title",
                "channel": None,
                "thumbnail_url": None,
            }


def get_thumbnail_url(video_id: str) -> str:
    """Get high-quality thumbnail URL."""
    return f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
