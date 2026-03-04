"""Share analytics endpoints."""

from datetime import datetime

from cachetools import TTLCache
from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.dependencies import get_database
from src.routes._helpers import cutoff

router = APIRouter(prefix="/shares", tags=["shares"])

_cache = TTLCache(maxsize=32, ttl=30)

MAX_DAYS = 90


class ShareTopItem(BaseModel):
    title: str | None
    youtubeId: str
    shareSlug: str
    viewsCount: int
    likesCount: int
    sharedAt: datetime | None
    outputType: str


class ShareStatsResponse(BaseModel):
    total_shared: int
    total_views: int
    total_likes: int
    avg_views: float


@router.get("/top")
async def shares_top(
    days: int = Query(30, ge=1, le=MAX_DAYS),
    limit: int = Query(10, ge=1, le=50),
) -> list[ShareTopItem]:
    """Top shared videos by view count."""
    cache_key = f"shares-top:{days}:{limit}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {"$match": {
            "shareSlug": {"$exists": True, "$ne": None},
            "sharedAt": {"$gte": cutoff(days)},
        }},
        {"$sort": {"viewsCount": -1}},
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "title": 1,
                "youtubeId": 1,
                "shareSlug": 1,
                "viewsCount": {"$ifNull": ["$viewsCount", 0]},
                "likesCount": {"$ifNull": ["$likesCount", 0]},
                "sharedAt": 1,
                "outputType": {"$ifNull": ["$outputType", "summary"]},
            }
        },
    ]
    results = await db.videoSummaryCache.aggregate(pipeline).to_list(limit)
    data = [ShareTopItem(**r) for r in results]
    _cache[cache_key] = data
    return data


@router.get("/stats")
async def shares_stats(days: int = Query(30, ge=1, le=MAX_DAYS)) -> ShareStatsResponse:
    """Aggregate share metrics."""
    cache_key = f"shares-stats:{days}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {"$match": {
            "shareSlug": {"$exists": True, "$ne": None},
            "sharedAt": {"$gte": cutoff(days)},
        }},
        {
            "$group": {
                "_id": None,
                "total_shared": {"$sum": 1},
                "total_views": {"$sum": {"$ifNull": ["$viewsCount", 0]}},
                "total_likes": {"$sum": {"$ifNull": ["$likesCount", 0]}},
                "avg_views": {"$avg": {"$ifNull": ["$viewsCount", 0]}},
            }
        },
    ]
    results = await db.videoSummaryCache.aggregate(pipeline).to_list(1)
    raw = results[0] if results else {
        "total_shared": 0,
        "total_views": 0,
        "total_likes": 0,
        "avg_views": 0,
    }
    raw.pop("_id", None)
    data = ShareStatsResponse(**raw)
    _cache[cache_key] = data
    return data
