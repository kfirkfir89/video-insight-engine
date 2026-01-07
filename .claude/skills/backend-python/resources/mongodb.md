# MongoDB Patterns (Motor/Beanie)

Async MongoDB with Motor driver and Beanie ODM.

---

## Connection Management

### DO ✅

```python
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Connect to MongoDB."""
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        maxPoolSize=10,
        minPoolSize=2,
        serverSelectionTimeoutMS=5000,
    )
    # Verify connection
    await _client.admin.command("ping")


async def close_db() -> None:
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        _client = None


async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance for dependency injection."""
    if not _client:
        raise RuntimeError("Database not connected")
    return _client[settings.MONGODB_DB_NAME]
```

### DON'T ❌

```python
# New connection per request
async def get_user(user_id: str):
    client = AsyncIOMotorClient(uri)
    db = client.mydb
    user = await db.users.find_one({"_id": user_id})
    client.close()  # Connection overhead every time!
    return user
```

---

## Beanie ODM

### DO ✅

```python
from beanie import Document, Indexed, init_beanie
from pydantic import EmailStr, Field
from datetime import datetime


class User(Document):
    email: Indexed(EmailStr, unique=True)
    name: str = Field(..., min_length=2, max_length=100)
    password_hash: str
    roles: list[str] = ["user"]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        use_state_management = True

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "name": "John Doe",
            }
        }


# Initialize Beanie
async def init_db():
    await init_beanie(
        database=_client[settings.MONGODB_DB_NAME],
        document_models=[User, Order, Product],
    )
```

### DON'T ❌

```python
# Raw dicts everywhere
user = {"email": email, "name": name}  # No validation!
await db.users.insert_one(user)
```

---

## Repository with Motor

### DO ✅

```python
from datetime import datetime, UTC
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.users

    async def create(self, **data) -> User:
        now = datetime.now(UTC)
        doc = {**data, "created_at": now, "updated_at": now}
        result = await self._collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return self._to_entity(doc)

    async def find_by_id(self, user_id: str) -> User | None:
        if not ObjectId.is_valid(user_id):
            return None
        doc = await self._collection.find_one({"_id": ObjectId(user_id)})
        return self._to_entity(doc) if doc else None

    async def find_all(
        self, skip: int = 0, limit: int = 20
    ) -> tuple[list[User], int]:
        cursor = (
            self._collection
            .find()
            .skip(skip)
            .limit(limit)
            .sort("created_at", -1)
        )
        docs = await cursor.to_list(length=limit)
        total = await self._collection.count_documents({})
        return [self._to_entity(doc) for doc in docs], total

    def _to_entity(self, doc: dict) -> User:
        return User(
            id=str(doc["_id"]),
            email=doc["email"],
            name=doc["name"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )
```

---

## Indexing

### DO ✅

```python
async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes on startup."""
    # Unique index
    await db.users.create_index("email", unique=True)

    # Compound index for queries
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])

    # Text index for search
    await db.products.create_index(
        [("name", "text"), ("description", "text")],
        weights={"name": 10, "description": 1},
    )

    # TTL index for auto-expiry
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)

    # Partial index
    await db.orders.create_index(
        "status",
        partialFilterExpression={"status": "pending"},
    )
```

---

## Aggregation

### DO ✅

```python
async def get_order_stats(user_id: str) -> dict:
    """Get order statistics for a user."""
    pipeline = [
        {"$match": {"user_id": ObjectId(user_id)}},
        {
            "$group": {
                "_id": None,
                "total_orders": {"$sum": 1},
                "total_spent": {"$sum": "$total"},
                "avg_order": {"$avg": "$total"},
            }
        },
    ]
    
    cursor = self._collection.aggregate(pipeline)
    result = await cursor.to_list(length=1)
    
    if not result:
        return {"total_orders": 0, "total_spent": 0, "avg_order": 0}
    
    return result[0]
```

---

## Pagination

### DO ✅

```python
async def find_paginated(
    self,
    cursor: str | None = None,
    limit: int = 20,
) -> tuple[list[Order], str | None]:
    """Cursor-based pagination (efficient)."""
    query = {"user_id": self._user_id}
    
    if cursor:
        query["_id"] = {"$lt": ObjectId(cursor)}

    docs = await (
        self._collection
        .find(query)
        .sort("_id", -1)
        .limit(limit + 1)  # Fetch one extra
        .to_list(length=limit + 1)
    )

    has_more = len(docs) > limit
    items = docs[:limit]
    next_cursor = str(items[-1]["_id"]) if has_more else None

    return [self._to_entity(doc) for doc in items], next_cursor
```

### DON'T ❌

```python
# Skip-based pagination (slow for large offsets)
page = 100
docs = await collection.find().skip((page - 1) * 20).limit(20).to_list(20)
# Scans 2000 documents!
```

---

## Transactions

### DO ✅

```python
async def transfer_funds(
    from_id: str,
    to_id: str,
    amount: float,
) -> None:
    """Transfer with transaction."""
    async with await _client.start_session() as session:
        async with session.start_transaction():
            # Debit source
            result = await db.accounts.find_one_and_update(
                {"_id": ObjectId(from_id), "balance": {"$gte": amount}},
                {"$inc": {"balance": -amount}},
                session=session,
            )
            
            if not result:
                raise BusinessError("Insufficient funds")

            # Credit destination
            await db.accounts.update_one(
                {"_id": ObjectId(to_id)},
                {"$inc": {"balance": amount}},
                session=session,
            )
```

---

## Beanie Queries

### DO ✅

```python
# Find with Beanie
user = await User.find_one(User.email == email)

# Update
user.name = "New Name"
await user.save()

# Query builder
users = await User.find(
    User.roles.in_(["admin"]),
    User.created_at > some_date,
).sort(-User.created_at).limit(10).to_list()

# Aggregation
stats = await User.aggregate([
    {"$group": {"_id": "$role", "count": {"$sum": 1}}}
]).to_list()
```

---

## Quick Reference

| Driver | Use Case |
|--------|----------|
| Motor | Low-level async driver |
| Beanie | ODM with Pydantic models |

| Pattern | When to Use |
|---------|-------------|
| Cursor pagination | Large datasets |
| Skip pagination | Small datasets only |
| Aggregation | Complex queries, analytics |
| Transactions | Multi-document atomicity |
| Indexes | Query optimization |

| Anti-Pattern | Problem |
|--------------|---------|
| Unbounded arrays | Document grows forever |
| Skip on large offsets | Slow queries |
| Missing indexes | Full collection scans |
| Connection per request | Overhead, exhaustion |
