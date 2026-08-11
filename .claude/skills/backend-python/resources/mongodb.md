# MongoDB Patterns (Motor / pymongo)

MongoDB access in this repo is split by service: **Motor** (async) in
`services/assistant` and `services/admin`; **sync pymongo** in
`services/summarizer` (its pipeline stages are LLM/CPU-bound, not DB-bound,
and run in a worker process). There is no ODM — no Beanie anywhere.

<rules>
- ALWAYS use a shared connection pool via module-level client with `maxPoolSize` (creating connections per request causes pool exhaustion under load)
- ALWAYS use cursor-based pagination for large datasets with `_id` ordering (skip-based pagination scans N documents for page N, becoming O(N) slow)
- ALWAYS create indexes for fields used in queries — add in `create_indexes()` called at startup (missing indexes cause full collection scans, degrading linearly with data size)
- ALWAYS convert MongoDB documents to domain entities via `_to_entity()` (leaking raw dicts with `_id` as ObjectId causes serialization errors in API responses)
- NEVER use `to_list(None)` on unbounded queries (loads entire collection into memory, causing OOM on large datasets)
- NEVER use string interpolation in MongoDB queries (enables NoSQL injection via `$where` or operator injection)
</rules>

---

## Connection Management

Use a module-level client with pool settings. Verify connection at startup with `ping`. Expose `get_database()` as a FastAPI dependency.

```python
_client: AsyncIOMotorClient | None = None

async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        maxPoolSize=10, minPoolSize=2,
        serverSelectionTimeoutMS=5000,
    )
    await _client.admin.command("ping")

async def get_database() -> AsyncIOMotorDatabase:
    if not _client:
        raise RuntimeError("Database not connected")
    return _client[settings.MONGODB_DB_NAME]
```

---

## Repository Pattern

Repositories own a collection reference, convert documents to entities, and handle ObjectId validation.

```python
class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.users

    async def find_by_id(self, user_id: str) -> User | None:
        if not ObjectId.is_valid(user_id):
            return None
        doc = await self._collection.find_one({"_id": ObjectId(user_id)})
        return self._to_entity(doc) if doc else None
```

---

## Cursor-Based Pagination

Fetch `limit + 1` to detect `has_more` without a separate count query.

```python
async def find_paginated(
    self, cursor: str | None = None, limit: int = 20,
) -> tuple[list[Order], str | None]:
    query = {"user_id": self._user_id}
    if cursor:
        query["_id"] = {"$lt": ObjectId(cursor)}
    docs = await (
        self._collection.find(query)
        .sort("_id", -1).limit(limit + 1)
        .to_list(length=limit + 1)
    )
    has_more = len(docs) > limit
    items = docs[:limit]
    next_cursor = str(items[-1]["_id"]) if has_more else None
    return [self._to_entity(d) for d in items], next_cursor
```

---

## Indexing & Aggregation

Create indexes at startup. Use aggregation pipelines for joins (`$lookup`) and analytics (`$group`). Use transactions (`start_session` + `start_transaction`) for multi-document atomicity.

```python
async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
```

---

## Motor vs pymongo (per service)

- **assistant / admin**: `AsyncIOMotorClient`, `await` every call, repositories
  as shown above.
- **summarizer**: sync `MongoClient` — same repository/`_to_entity()` shape,
  just without `await`. Do NOT call sync pymongo from FastAPI async handlers
  in the other services; keep it inside the summarizer's worker/pipeline code.
- Pydantic models are used for validation at boundaries, but documents are
  plain dicts mapped via `_to_entity()` — there is no document ODM layer.

---

## Edge Cases

- **ObjectId validation**: Always check `ObjectId.is_valid(id)` before querying. Invalid IDs should return None, not raise.
- **Unbounded arrays in documents**: Arrays that grow without limit (e.g., embedded comments) cause document size to exceed 16MB. Use a separate collection with a foreign key instead.
- **Count queries on large collections**: `count_documents({})` is slow on millions of records. Use `estimated_document_count()` for approximate counts in UI pagination.

---

## Rules Summary

Use a shared client with connection pooling (Motor in assistant/admin, sync pymongo in summarizer). Create indexes at startup for every query pattern. Convert documents to domain entities in repositories — never leak raw dicts. Use cursor-based pagination for performance. Use aggregation pipelines for joins and analytics. Always validate ObjectIds before querying. Limit `to_list()` calls with explicit length. Use transactions for multi-document atomicity.
