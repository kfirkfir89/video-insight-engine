"""Usage analytics endpoints for LLM cost monitoring."""

import asyncio
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from cachetools import TTLCache
from fastapi import APIRouter, HTTPException, Path, Query

from src.dependencies import get_database
from src.routes._helpers import cutoff as _cutoff


def _serialize_value(v: object) -> object:
    """Serialize a single MongoDB value for JSON response."""
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, dict):
        return _serialize_doc(v)
    if isinstance(v, list):
        return [_serialize_value(item) for item in v]
    return v


def _serialize_doc(doc: dict) -> dict:
    """Serialize MongoDB document for JSON response.

    Recursively converts ObjectId to str, datetime to ISO format string,
    and handles nested dicts and lists.
    """
    return {k: _serialize_value(v) for k, v in doc.items()}


router = APIRouter(prefix="/usage", tags=["usage"])

# 30-second cache for expensive aggregations
_cache = TTLCache(maxsize=64, ttl=30)

MAX_DAYS = 90


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
    # Add computed total_tokens field
    data["total_tokens"] = (data.get("total_tokens_in") or 0) + (data.get("total_tokens_out") or 0)
    _cache[cache_key] = data
    return data


@router.get("/by-output-type")
async def usage_by_output_type(days: int = Query(30, ge=1, le=MAX_DAYS)) -> list[dict[str, object]]:
    """LLM cost/calls aggregated by video outputType."""
    cache_key = f"by-output-type:{days}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    # Group by video_id first to reduce lookups from N usage docs to M unique videos
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}, "video_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$video_id",
                "cost_usd": {"$sum": "$cost_usd"},
                "calls": {"$sum": 1},
                "tokens": {"$sum": {"$add": [{"$ifNull": ["$tokens_in", 0]}, {"$ifNull": ["$tokens_out", 0]}]}},
            }
        },
        {
            "$lookup": {
                "from": "videoSummaryCache",
                "localField": "_id",
                "foreignField": "youtubeId",
                "as": "_video",
                "pipeline": [{"$project": {"outputType": 1}}],
            }
        },
        {"$unwind": {"path": "$_video", "preserveNullAndEmptyArrays": True}},
        {
            "$group": {
                "_id": {"$ifNull": ["$_video.outputType", "summary"]},
                "cost_usd": {"$sum": "$cost_usd"},
                "calls": {"$sum": "$calls"},
                "tokens": {"$sum": "$tokens"},
            }
        },
        {"$sort": {"cost_usd": -1}},
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(50)
    data = [
        {"output_type": r["_id"], **{k: v for k, v in r.items() if k != "_id"}}
        for r in results
    ]
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


def _format_video_metadata(doc: dict | None) -> dict | None:
    """Format a videoSummaryCache document into API-friendly metadata."""
    if not doc:
        return None
    return {
        "title": doc.get("title"),
        "channel": doc.get("channel"),
        "duration": doc.get("duration"),
        "thumbnail_url": doc.get("thumbnailUrl"),
        "status": doc.get("status"),
        "category": (doc.get("context") or {}).get("category"),
        "processed_at": doc["processedAt"].isoformat() if doc.get("processedAt") else None,
    }


def _format_video_usage_item(r: dict) -> dict:
    """Map an aggregation result (with $lookup metadata) to API-friendly dict."""
    v = r.get("_v") or {}
    item = {
        "video_id": r["_id"],
        "calls": r["calls"],
        "cost_usd": r["cost_usd"],
        "tokens_in": r["tokens_in"],
        "tokens_out": r["tokens_out"],
        "first_call": r["first_call"].isoformat() if r.get("first_call") else None,
        "last_call": r["last_call"].isoformat() if r.get("last_call") else None,
    }
    metadata = _format_video_metadata(v)
    if metadata:
        item.update(metadata)
    return item


_VIDEO_LOOKUP_STAGE: list[dict] = [
    {
        "$lookup": {
            "from": "videoSummaryCache",
            "localField": "_id",
            "foreignField": "youtubeId",
            "as": "_v",
            "pipeline": [
                {
                    "$project": {
                        "title": 1,
                        "channel": 1,
                        "duration": 1,
                        "thumbnailUrl": 1,
                        "status": 1,
                        "context.category": 1,
                        "processedAt": 1,
                    }
                }
            ],
        }
    },
    {"$unwind": {"path": "$_v", "preserveNullAndEmptyArrays": True}},
]


@router.get("/by-video")
async def usage_by_video(
    days: int = Query(30, ge=1, le=MAX_DAYS),
    limit: int = Query(20, ge=1, le=100),
):
    """Top videos by total cost, enriched with video metadata."""
    cache_key = f"by-video:{days}:{limit}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": _cutoff(days)}, "video_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$video_id",
                "calls": {"$sum": 1},
                "cost_usd": {"$sum": "$cost_usd"},
                "tokens_in": {"$sum": "$tokens_in"},
                "tokens_out": {"$sum": "$tokens_out"},
                "first_call": {"$min": "$timestamp"},
                "last_call": {"$max": "$timestamp"},
            }
        },
        {"$sort": {"cost_usd": -1}},
        {"$limit": limit},
        *_VIDEO_LOOKUP_STAGE,
    ]
    results = await db.llm_usage.aggregate(pipeline).to_list(limit)
    data = [_format_video_usage_item(r) for r in results]
    _cache[cache_key] = data
    return data


def _format_usage_summary(results: list[dict]) -> dict:
    """Format aggregated usage summary, converting datetimes to ISO strings."""
    summary = results[0] if results else {
        "total_calls": 0, "total_cost_usd": 0,
        "total_tokens_in": 0, "total_tokens_out": 0,
        "avg_duration_ms": 0, "first_call": None, "last_call": None,
    }
    summary.pop("_id", None)
    if summary.get("first_call"):
        summary["first_call"] = summary["first_call"].isoformat()
    if summary.get("last_call"):
        summary["last_call"] = summary["last_call"].isoformat()
    return summary


@router.get("/video/{video_id}")
async def usage_for_video(video_id: str = Path(..., min_length=1, max_length=64)):
    """Detailed usage for a specific video: metadata, summary, feature breakdown, and raw calls."""
    cache_key = f"video:{video_id}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()

    # Run all independent queries in parallel
    summary_pipeline = [
        {"$match": {"video_id": video_id}},
        {
            "$group": {
                "_id": None,
                "total_calls": {"$sum": 1},
                "total_cost_usd": {"$sum": "$cost_usd"},
                "total_tokens_in": {"$sum": "$tokens_in"},
                "total_tokens_out": {"$sum": "$tokens_out"},
                "avg_duration_ms": {"$avg": "$duration_ms"},
                "first_call": {"$min": "$timestamp"},
                "last_call": {"$max": "$timestamp"},
            }
        },
    ]
    feature_pipeline = [
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

    video_doc, summary_results, feature_results, raw_calls = await asyncio.gather(
        db.videoSummaryCache.find_one(
            {"youtubeId": video_id},
            {
                "title": 1, "channel": 1, "duration": 1,
                "thumbnailUrl": 1, "status": 1,
                "context.category": 1, "processedAt": 1,
            },
        ),
        db.llm_usage.aggregate(summary_pipeline).to_list(1),
        db.llm_usage.aggregate(feature_pipeline).to_list(50),
        db.llm_usage.find(
            {"video_id": video_id},
            {"prompt_preview": 0},
        ).sort("timestamp", -1).limit(50).to_list(50),
    )

    video = _format_video_metadata(video_doc)
    summary = _format_usage_summary(summary_results)
    by_feature = [{"feature": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in feature_results]

    result = {
        "video": video,
        "summary": summary,
        "by_feature": by_feature,
        "calls": [_serialize_doc(r) for r in raw_calls],
    }
    _cache[cache_key] = result
    return result


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
    return [_serialize_doc(r) for r in results]


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
    return [_serialize_doc(r) for r in results]


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
