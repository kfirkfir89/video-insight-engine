"""Alert management endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.dependencies import get_database

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/recent")
async def recent_alerts(limit: int = Query(20, ge=1, le=100)):
    """Recent alerts from llm_alerts collection."""
    db = get_database()
    cursor = db.llm_alerts.find().sort("timestamp", -1).limit(limit)
    results = await cursor.to_list(limit)
    for r in results:
        r["_id"] = str(r["_id"])
        if "timestamp" in r:
            r["timestamp"] = r["timestamp"].isoformat()
    return results


@router.get("/config")
async def get_alert_config():
    """Current alert thresholds."""
    db = get_database()
    config = await db.llm_alert_config.find_one({"_id": "default"})
    if not config:
        return {
            "cost_threshold_usd": 0.50,
            "daily_spike_multiplier": 2.0,
            "failure_rate_threshold": 0.20,
        }
    config["_id"] = str(config["_id"])
    return config


class AlertConfigInput(BaseModel):
    cost_threshold_usd: float = Field(0.50, ge=0)
    daily_spike_multiplier: float = Field(2.0, ge=1)
    failure_rate_threshold: float = Field(0.20, ge=0, le=1)


@router.post("/config")
async def update_alert_config(body: AlertConfigInput):
    """Update alert thresholds."""
    db = get_database()
    config = {
        "_id": "default",
        **body.model_dump(),
        "updated_at": datetime.now(UTC),
    }
    await db.llm_alert_config.replace_one({"_id": "default"}, config, upsert=True)
    return config
