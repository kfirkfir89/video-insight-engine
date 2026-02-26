"""Daily rollup aggregation from llm_usage to llm_usage_daily."""

from datetime import UTC, datetime, timedelta

import structlog

from src.dependencies import get_database

logger = structlog.get_logger(__name__)


async def aggregate_daily(target_date: str | None = None) -> dict:
    """Aggregate llm_usage records into llm_usage_daily.

    Args:
        target_date: Date string YYYY-MM-DD to aggregate. Defaults to yesterday.

    Returns:
        Dict with count of records created/updated.
    """
    if target_date:
        try:
            day_start = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=UTC)
        except ValueError:
            raise ValueError("Invalid date format. Expected YYYY-MM-DD.")
    else:
        day_start = (datetime.now(UTC) - timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    day_end = day_start + timedelta(days=1)

    db = get_database()
    pipeline = [
        {"$match": {"timestamp": {"$gte": day_start, "$lt": day_end}}},
        {
            "$group": {
                "_id": {
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    "feature": "$feature",
                    "model": "$model",
                    "provider": "$provider",
                    "service": "$service",
                },
                "call_count": {"$sum": 1},
                "tokens_in": {"$sum": "$tokens_in"},
                "tokens_out": {"$sum": "$tokens_out"},
                "total_cost_usd": {"$sum": "$cost_usd"},
                "avg_duration_ms": {"$avg": "$duration_ms"},
                "success_count": {"$sum": {"$cond": ["$success", 1, 0]}},
                "failure_count": {"$sum": {"$cond": ["$success", 0, 1]}},
            }
        },
    ]

    results = await db.llm_usage.aggregate(pipeline).to_list(1000)
    upserted = 0

    for r in results:
        doc = {**r["_id"], **{k: v for k, v in r.items() if k != "_id"}}
        filter_key = {
            "date": doc["date"],
            "feature": doc["feature"],
            "model": doc["model"],
            "provider": doc["provider"],
            "service": doc["service"],
        }
        await db.llm_usage_daily.replace_one(filter_key, doc, upsert=True)
        upserted += 1

    logger.info("daily_aggregation_complete", date=day_start.strftime("%Y-%m-%d"), records=upserted)
    return {"date": day_start.strftime("%Y-%m-%d"), "records_upserted": upserted}
