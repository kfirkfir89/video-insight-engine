"""Usage analytics endpoints for LLM cost monitoring."""

from datetime import UTC, datetime, timedelta

from bson import ObjectId
from bson.errors import InvalidId
from cachetools import TTLCache
from fastapi import APIRouter, HTTPException, Path, Query

from src.dependencies import get_database

router = APIRouter(prefix="/usage", tags=["usage"])

# 30-second cache for expensive aggregations
_cache = TTLCache(maxsize=64, ttl=30)

MAX_DAYS = 90


def _clamp_days(days: int) -> int:
    return min(max(days, 1), MAX_DAYS)


def _cutoff(days: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=_clamp_days(days))


@router.get("/stats")
async def usage_stats(
    days: int = Query(30, ge=1, le=MAX_DAYS),
    feature: str | None = None,
    provider: str | None = None,
    service: str | None = None,
):
    """Aggregated usage totals with optional filters."""
    cache_key = f"stats:{days}:{feature}:{provider}:{service}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    match = {"timestamp": {"$gte": _cutoff(days)}}
    if feature:
        match["feature"] = feature
    if provider:
        match["provider"] = provider
    if service:
        match["service"] = service

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": None,
                "total_calls": {"$sum": 1},
                "total_tokens_in": {"$sum": "$tokens_in"},
                "total_tokens_out": {"$sum": "$tokens_out"},
                "total_cost_usd": {"$sum": "$cost_usd"},
                "avg_duration_ms": {"$avg": "$duration_ms"},
                "success_count": {"$sum": {"$cond": ["$success", 1, 0]}},
                "failure_count": {"$sum": {"$cond": ["$success", 0, 1]}},
            }
        },
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(1)
    data = results[0] if results else {
        "total_calls": 0,
        "total_tokens_in": 0,
        "total_tokens_out": 0,
        "total_cost_usd": 0,
        "avg_duration_ms": 0,
        "success_count": 0,
        "failure_count": 0,
    }
    data.pop("_id", None)
    _cache[cache_key] = data
    return data


@router.get("/daily")
async def usage_daily(days: int = Query(30, ge=1, le=MAX_DAYS)):
    """Daily breakdown for time-series charts."""
    cache_key = f"daily:{days}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "calls": {"$sum": 1},
                "cost_usd": {"$sum": "$cost_usd"},
                "tokens_in": {"$sum": "$tokens_in"},
                "tokens_out": {"$sum": "$tokens_out"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(MAX_DAYS)
    data = [{"date": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in results]
    _cache[cache_key] = data
    return data


@router.get("/by-feature")
async def usage_by_feature(days: int = Query(30, ge=1, le=MAX_DAYS)):
    """Cost per feature, sorted descending."""
    cache_key = f"by-feature:{days}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}}},
        {
            "$group": {
                "_id": "$feature",
                "calls": {"$sum": 1},
                "cost_usd": {"$sum": "$cost_usd"},
                "avg_duration_ms": {"$avg": "$duration_ms"},
            }
        },
        {"$sort": {"cost_usd": -1}},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(50)
    data = [{"feature": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in results]
    _cache[cache_key] = data
    return data


@router.get("/by-model")
async def usage_by_model(days: int = Query(30, ge=1, le=MAX_DAYS)):
    """Cost per model, sorted descending."""
    cache_key = f"by-model:{days}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}}},
        {
            "$group": {
                "_id": "$model",
                "calls": {"$sum": 1},
                "cost_usd": {"$sum": "$cost_usd"},
                "tokens_in": {"$sum": "$tokens_in"},
                "tokens_out": {"$sum": "$tokens_out"},
            }
        },
        {"$sort": {"cost_usd": -1}},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(50)
    data = [{"model": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in results]
    _cache[cache_key] = data
    return data


@router.get("/by-service")
async def usage_by_service(days: int = Query(30, ge=1, le=MAX_DAYS)):
    """Cost per service."""
    cache_key = f"by-service:{days}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}}},
        {
            "$group": {
                "_id": "$service",
                "calls": {"$sum": 1},
                "cost_usd": {"$sum": "$cost_usd"},
            }
        },
        {"$sort": {"cost_usd": -1}},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(20)
    data = [{"service": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in results]
    _cache[cache_key] = data
    return data


@router.get("/by-video")
async def usage_by_video(
    days: int = Query(30, ge=1, le=MAX_DAYS),
    limit: int = Query(20, ge=1, le=100),
):
    """Top videos by total cost."""
    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}, "video_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$video_id",
                "calls": {"$sum": 1},
                "cost_usd": {"$sum": "$cost_usd"},
            }
        },
        {"$sort": {"cost_usd": -1}},
        {"$limit": limit},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(limit)
    return [{"video_id": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in results]


@router.get("/video/{video_id}")
async def usage_for_video(video_id: str = Path(..., min_length=1, max_length=64)):
    """All calls for a specific video with feature breakdown."""
    db = get_database()
    pipeline = [
        {"$match": {"video_id": video_id}},
        {
            "$group": {
                "_id": "$feature",
                "calls": {"$sum": 1},
                "cost_usd": {"$sum": "$cost_usd"},
                "tokens_in": {"$sum": "$tokens_in"},
                "tokens_out": {"$sum": "$tokens_out"},
                "avg_duration_ms": {"$avg": "$duration_ms"},
            }
        },
        {"$sort": {"cost_usd": -1}},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(50)
    return [{"feature": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in results]


@router.get("/anomalies")
async def usage_anomalies(
    threshold_usd: float = Query(0.50, ge=0),
    days: int = Query(7, ge=1, le=MAX_DAYS),
):
    """Expensive calls above threshold."""
    db = get_database()
    cursor = db.llm_usage.find(
        {"cost_usd": {"$gt": threshold_usd}, "timestamp": {"$gte": _cutoff(days)}},
        {"prompt_preview": 0},
    ).sort("cost_usd", -1).limit(50)
    results = await cursor.to_list(50)
    for r in results:
        r["_id"] = str(r["_id"])
    return results


@router.get("/recent")
async def usage_recent(
    limit: int = Query(20, ge=1, le=100),
    before_id: str | None = None,
):
    """Cursor-based pagination of recent calls."""
    # Validate cursor before touching DB
    query: dict = {}
    if before_id:
        try:
            query["_id"] = {"$lt": ObjectId(before_id)}
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid cursor ID format")

    db = get_database()

    cursor = db.llm_usage.find(query).sort("_id", -1).limit(limit)
    results = await cursor.to_list(limit)
    for r in results:
        r["_id"] = str(r["_id"])
        if "timestamp" in r:
            r["timestamp"] = r["timestamp"].isoformat()
    return results


@router.get("/duplicates")
async def usage_duplicates(
    days: int = Query(7, ge=1, le=MAX_DAYS),
    min_count: int = Query(3, ge=2),
):
    """Group by prompt_hash to find duplicate prompts."""
    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}, "prompt_hash": {"$ne": ""}}},
        {
            "$group": {
                "_id": "$prompt_hash",
                "count": {"$sum": 1},
                "total_cost_usd": {"$sum": "$cost_usd"},
                "model": {"$first": "$model"},
                "feature": {"$first": "$feature"},
                "prompt_preview": {"$first": "$prompt_preview"},
            }
        },
        {"$match": {"count": {"$gte": min_count}}},
        {"$sort": {"total_cost_usd": -1}},
        {"$limit": 20},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(20)
    return [{"prompt_hash": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in results]
