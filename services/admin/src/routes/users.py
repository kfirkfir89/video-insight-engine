"""Per-user cost & credit endpoints."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from cachetools import TTLCache
from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

from src.dependencies import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

# Cached: per-user aggregates are expensive but tolerate ~30s lag.
_cache: TTLCache[str, Any] = TTLCache(maxsize=64, ttl=30)

MAX_DAYS = 90


def _utc_date_key(date: datetime) -> str:
    """Format a UTC datetime as ``YYYY-MM-DD``."""
    return date.strftime("%Y-%m-%d")


def _since_date_key(days: int) -> str:
    """UTC ``YYYY-MM-DD`` for ``days`` ago (inclusive of today)."""
    since = datetime.now(UTC) - timedelta(days=max(days - 1, 0))
    return _utc_date_key(since)


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid id format") from exc


class UserCostRow(BaseModel):
    userId: str
    email: str | None
    name: str | None
    tier: str
    totalCostUsd: float
    videoCount: int
    creditAdjustmentUsd: float
    effectiveUsd: float
    days: int


class UserDailyRow(BaseModel):
    date: str
    totalCostUsd: float
    videoCount: int
    creditAdjustmentUsd: float
    effectiveUsd: float


class UserCostDetail(BaseModel):
    user: UserCostRow
    daily: list[UserDailyRow]
    adjustments: list[dict[str, Any]]


class GrantCreditRequest(BaseModel):
    amountUsd: float = Field(
        ...,
        description=(
            "USD signed. Positive value grants credit (reduces effective usage). "
            "Use 0 to log a no-op audit row."
        ),
    )
    reason: str = Field(..., min_length=1, max_length=500)
    adminId: str = Field(..., description="ObjectId of the admin issuing the grant")
    date: str | None = Field(
        None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="UTC YYYY-MM-DD; defaults to today",
    )


class GrantCreditResponse(BaseModel):
    userId: str
    date: str
    amountUsd: float
    creditAdjustmentUsd: float
    effectiveUsd: float


@router.get("/costs")
async def list_user_costs(
    days: int = Query(7, ge=1, le=MAX_DAYS),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[UserCostRow]:
    """Top users by effective cost over the trailing window."""
    cache_key = f"user-costs:{days}:{limit}:{offset}"
    if cache_key in _cache:
        return _cache[cache_key]

    db = get_database()
    since_key = _since_date_key(days)

    pipeline = [
        {"$match": {"date": {"$gte": since_key}}},
        {
            "$group": {
                "_id": "$userId",
                "totalCostUsd": {"$sum": "$totalCostUsd"},
                "videoCount": {"$sum": "$videoCount"},
                "creditAdjustmentUsd": {"$sum": "$creditAdjustmentUsd"},
                "days": {"$sum": 1},
            }
        },
        {
            "$addFields": {
                "effectiveUsd": {"$add": ["$totalCostUsd", "$creditAdjustmentUsd"]},
            }
        },
        {"$sort": {"effectiveUsd": -1}},
        {"$skip": offset},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "_id",
                "as": "_user",
                "pipeline": [{"$project": {"email": 1, "name": 1, "tier": 1}}],
            }
        },
        {"$unwind": {"path": "$_user", "preserveNullAndEmptyArrays": True}},
    ]

    raw = await db.userCosts.aggregate(pipeline).to_list(limit)
    data = [
        UserCostRow(
            userId=str(row["_id"]),
            email=(row.get("_user") or {}).get("email"),
            name=(row.get("_user") or {}).get("name"),
            tier=(row.get("_user") or {}).get("tier") or "free",
            totalCostUsd=row["totalCostUsd"],
            videoCount=row["videoCount"],
            creditAdjustmentUsd=row["creditAdjustmentUsd"],
            effectiveUsd=row["effectiveUsd"],
            days=row["days"],
        )
        for row in raw
    ]
    _cache[cache_key] = data
    return data


@router.get("/{user_id}/costs")
async def user_cost_detail(
    user_id: str = Path(..., min_length=24, max_length=24),
    days: int = Query(30, ge=1, le=MAX_DAYS),
) -> UserCostDetail:
    """Per-user daily breakdown + recent adjustments."""
    user_oid = _parse_object_id(user_id)
    db = get_database()
    since_key = _since_date_key(days)

    user_doc = await db.users.find_one(
        {"_id": user_oid},
        {"email": 1, "name": 1, "tier": 1},
    )

    daily_cursor = db.userCosts.find(
        {"userId": user_oid, "date": {"$gte": since_key}},
    ).sort("date", 1)
    daily_docs = await daily_cursor.to_list(MAX_DAYS)

    daily_rows: list[UserDailyRow] = []
    raw_total = 0.0
    raw_credit = 0.0
    video_count = 0
    for doc in daily_docs:
        total = float(doc.get("totalCostUsd", 0) or 0)
        credit = float(doc.get("creditAdjustmentUsd", 0) or 0)
        videos = int(doc.get("videoCount", 0) or 0)
        raw_total += total
        raw_credit += credit
        video_count += videos
        daily_rows.append(
            UserDailyRow(
                date=doc["date"],
                totalCostUsd=total,
                videoCount=videos,
                creditAdjustmentUsd=credit,
                effectiveUsd=total + credit,
            )
        )

    summary = UserCostRow(
        userId=user_id,
        email=(user_doc or {}).get("email"),
        name=(user_doc or {}).get("name"),
        tier=(user_doc or {}).get("tier") or "free",
        totalCostUsd=raw_total,
        videoCount=video_count,
        creditAdjustmentUsd=raw_credit,
        effectiveUsd=raw_total + raw_credit,
        days=len(daily_rows),
    )

    adj_cursor = db.userCostAdjustments.find({"userId": user_oid}).sort("createdAt", -1).limit(20)
    adjustments_raw = await adj_cursor.to_list(20)
    adjustments = [
        {
            "id": str(a["_id"]),
            "date": a.get("date"),
            "amountUsd": float(a.get("amountUsd", 0) or 0),
            "reason": a.get("reason"),
            "adminId": str(a["adminId"]) if a.get("adminId") else None,
            "createdAt": a.get("createdAt").isoformat() if a.get("createdAt") else None,
        }
        for a in adjustments_raw
    ]

    return UserCostDetail(user=summary, daily=daily_rows, adjustments=adjustments)


@router.post("/{user_id}/grant-credit")
async def grant_credit(
    body: GrantCreditRequest,
    user_id: str = Path(..., min_length=24, max_length=24),
) -> GrantCreditResponse:
    """Apply a signed adjustment to a user's day and audit it.

    `amountUsd` semantics (HTTP boundary):
        - Positive  → grant credit (subtracts from effective usage).
        - Negative  → admin manually charges the user extra.
        - 0         → no-op audit row.

    Storage convention (DB, canonical): `userCostAdjustments.amountUsd` is
    stored signed where negative = credit, positive = charge. This route
    negates the user-facing input on the way in so the storage convention
    matches the Node `UserCostRepository.addAdjustment` contract.

    Audit-trail caveat: this service authenticates with a shared `ADMIN_API_KEY`
    (see `src/auth.py`), so `adminId` in the request body is self-attested. For
    a single-admin team this is acceptable; for multi-admin orgs, swap the
    shared key for per-admin credentials and derive `adminId` from the session
    rather than trusting the request body.
    """
    if body.amountUsd > 1000 or body.amountUsd < -1000:
        raise HTTPException(status_code=422, detail="amountUsd out of range [-1000, 1000]")

    user_oid = _parse_object_id(user_id)
    admin_oid = _parse_object_id(body.adminId)

    db = get_database()

    # Verify the user exists before recording the adjustment.
    user_doc = await db.users.find_one({"_id": user_oid}, {"email": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    date_key = body.date or _utc_date_key(datetime.now(UTC))

    # Adjustment stored as a signed value where credits LOWER effective usage.
    # `amountUsd` > 0 from the API means "grant N USD of credit" → stored as -N.
    signed_amount = -body.amountUsd

    await db.userCosts.update_one(
        {"userId": user_oid, "date": date_key},
        {
            "$inc": {"creditAdjustmentUsd": signed_amount},
            "$setOnInsert": {"totalCostUsd": 0.0, "videoCount": 0},
            "$set": {"updatedAt": datetime.now(UTC)},
        },
        upsert=True,
    )

    await db.userCostAdjustments.insert_one(
        {
            "userId": user_oid,
            "date": date_key,
            "amountUsd": signed_amount,
            "reason": body.reason.strip(),
            "adminId": admin_oid,
            "createdAt": datetime.now(UTC),
        }
    )

    refreshed = await db.userCosts.find_one({"userId": user_oid, "date": date_key})
    raw_total = float((refreshed or {}).get("totalCostUsd", 0) or 0)
    raw_credit = float((refreshed or {}).get("creditAdjustmentUsd", 0) or 0)

    # Best-effort cache invalidation so the dashboard reflects the change quickly.
    _cache.clear()

    return GrantCreditResponse(
        userId=user_id,
        date=date_key,
        amountUsd=body.amountUsd,
        creditAdjustmentUsd=raw_credit,
        effectiveUsd=raw_total + raw_credit,
    )
