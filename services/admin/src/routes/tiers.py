"""Tier distribution analytics endpoint."""

from cachetools import TTLCache
from fastapi import APIRouter
from pydantic import BaseModel

from src.dependencies import get_database

router = APIRouter(prefix="/tiers", tags=["tiers"])

_cache = TTLCache(maxsize=8, ttl=60)


class TierItem(BaseModel):
    tier: str
    count: int
    percentage: float


@router.get("/distribution")
async def tier_distribution() -> list[TierItem]:
    """User count per tier."""
    cache_key = "tier-distribution"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {
            "$group": {
                "_id": {"$ifNull": ["$tier", "free"]},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"count": -1}},
    ]
    results = await db.users.aggregate(pipeline).to_list(20)
    total = sum(r["count"] for r in results)
    data = [
        TierItem(
            tier=r["_id"],
            count=r["count"],
            percentage=round((r["count"] / total) * 100, 1) if total > 0 else 0,
        )
        for r in results
    ]
    _cache[cache_key] = data
    return data
