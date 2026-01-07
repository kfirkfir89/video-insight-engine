# Complete Examples

Full working code examples showing all layers together.

---

## Table of Contents

- [Complete Router](#complete-router)
- [Complete Service with DI](#complete-service-with-di)
- [Complete Repository](#complete-repository)
- [Complete Schemas](#complete-schemas)
- [Refactoring: Bad to Good](#refactoring-bad-to-good)
- [End-to-End Feature](#end-to-end-feature)

---

## Complete Router

```python
# app/users/router.py
from typing import Annotated

from fastapi import APIRouter, Depends, status, Query

from app.users.schemas import UserCreate, UserUpdate, UserResponse, UserList
from app.users.service import UserService
from app.users.dependencies import get_user_service
from app.core.dependencies import get_current_user

router = APIRouter()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    """Create a new user."""
    return await service.create(data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserResponse:
    """Get user by ID."""
    return await service.find_by_id(user_id)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserResponse:
    """Update user."""
    return await service.update(user_id, data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[dict, Depends(require_role("admin"))],
) -> None:
    """Delete user (admin only)."""
    await service.delete(user_id)


@router.get("", response_model=UserList)
async def list_users(
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[dict, Depends(get_current_user)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> UserList:
    """List users with pagination."""
    return await service.find_all(skip=skip, limit=limit)
```

---

## Complete Service with DI

```python
# app/users/service.py
from app.users.repository import UserRepository
from app.users.schemas import UserCreate, UserUpdate, UserResponse, UserList
from app.users.models import User
from app.core.exceptions import NotFoundError, ConflictError
from app.core.security import hash_password
from app.cache.service import CacheService


class UserService:
    CACHE_TTL = 3600

    def __init__(
        self,
        repository: UserRepository,
        cache: CacheService,
    ) -> None:
        self._repo = repository
        self._cache = cache

    async def create(self, data: UserCreate) -> UserResponse:
        """Create a new user."""
        # Business rule: email uniqueness
        existing = await self._repo.find_by_email(data.email)
        if existing:
            raise ConflictError("Email already registered")

        # Business logic: hash password
        password_hash = hash_password(data.password)

        user = await self._repo.create(
            email=data.email.lower(),
            name=data.name,
            password_hash=password_hash,
        )

        return UserResponse.model_validate(user)

    async def find_by_id(self, user_id: str) -> UserResponse:
        """Find user by ID with caching."""
        cache_key = f"user:{user_id}"

        # Check cache
        cached = await self._cache.get(cache_key)
        if cached:
            return UserResponse.model_validate(cached)

        # Fetch from DB
        user = await self._repo.find_by_id(user_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")

        # Cache result
        response = UserResponse.model_validate(user)
        await self._cache.set(cache_key, response.model_dump(), self.CACHE_TTL)

        return response

    async def update(self, user_id: str, data: UserUpdate) -> UserResponse:
        """Update user."""
        existing = await self._repo.find_by_id(user_id)
        if not existing:
            raise NotFoundError(f"User not found: {user_id}")

        # Business rule: email uniqueness
        if data.email and data.email != existing.email:
            email_taken = await self._repo.find_by_email(data.email)
            if email_taken:
                raise ConflictError("Email already in use")

        user = await self._repo.update(user_id, data.model_dump(exclude_unset=True))

        # Invalidate cache
        await self._cache.delete(f"user:{user_id}")

        return UserResponse.model_validate(user)

    async def delete(self, user_id: str) -> None:
        """Delete user."""
        existing = await self._repo.find_by_id(user_id)
        if not existing:
            raise NotFoundError(f"User not found: {user_id}")

        await self._repo.delete(user_id)
        await self._cache.delete(f"user:{user_id}")

    async def find_all(self, skip: int = 0, limit: int = 20) -> UserList:
        """Find all users with pagination."""
        users, total = await self._repo.find_all(skip=skip, limit=limit)
        return UserList(
            data=[UserResponse.model_validate(u) for u in users],
            total=total,
            skip=skip,
            limit=limit,
        )
```

---

## Complete Repository

```python
# app/users/repository.py
from datetime import datetime, UTC
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.models import User


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.users

    async def create(self, **data: Any) -> User:
        """Create a new user."""
        now = datetime.now(UTC)
        doc = {
            **data,
            "created_at": now,
            "updated_at": now,
        }
        result = await self._collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return self._to_entity(doc)

    async def find_by_id(self, user_id: str) -> User | None:
        """Find user by ID."""
        if not ObjectId.is_valid(user_id):
            return None
        doc = await self._collection.find_one({"_id": ObjectId(user_id)})
        return self._to_entity(doc) if doc else None

    async def find_by_email(self, email: str) -> User | None:
        """Find user by email."""
        doc = await self._collection.find_one({"email": email.lower()})
        return self._to_entity(doc) if doc else None

    async def update(self, user_id: str, data: dict[str, Any]) -> User:
        """Update user."""
        result = await self._collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": {**data, "updated_at": datetime.now(UTC)}},
            return_document=True,
        )
        return self._to_entity(result)

    async def delete(self, user_id: str) -> None:
        """Delete user."""
        await self._collection.delete_one({"_id": ObjectId(user_id)})

    async def find_all(
        self, skip: int = 0, limit: int = 20
    ) -> tuple[list[User], int]:
        """Find all users with pagination."""
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

    def _to_entity(self, doc: dict[str, Any]) -> User:
        """Convert MongoDB document to domain entity."""
        return User(
            id=str(doc["_id"]),
            email=doc["email"],
            name=doc["name"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )
```

---

## Complete Schemas

```python
# app/users/schemas.py
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserCreate(BaseModel):
    """Input for creating a user."""
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    """Input for updating a user."""
    name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None


class UserResponse(BaseModel):
    """Output for user data."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    created_at: datetime
    updated_at: datetime


class UserList(BaseModel):
    """Paginated list of users."""
    data: list[UserResponse]
    total: int
    skip: int
    limit: int
```

---

## Refactoring: Bad to Good

### Before (Everything in Route Handler)

```python
# ❌ BAD: Handler does everything
@router.post("/users")
async def create_user(request: Request):
    data = await request.json()

    # Validation in handler
    if "email" not in data:
        raise HTTPException(400, "Email required")
    if "@" not in data["email"]:
        raise HTTPException(400, "Invalid email")

    # Database access in handler
    db = get_database()
    existing = await db.users.find_one({"email": data["email"]})
    if existing:
        raise HTTPException(409, "Email exists")

    # Business logic in handler
    password_hash = bcrypt.hash(data["password"])

    # Insert in handler
    result = await db.users.insert_one({
        "email": data["email"],
        "name": data["name"],
        "password_hash": password_hash,
        "created_at": datetime.now(),
    })

    return {"id": str(result.inserted_id)}
```

### After (Properly Layered)

```python
# ✅ GOOD: Each layer has one job

# Router - HTTP concerns
@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,  # Pydantic validates
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    return await service.create(data)


# Service - business logic
async def create(self, data: UserCreate) -> UserResponse:
    existing = await self._repo.find_by_email(data.email)
    if existing:
        raise ConflictError("Email already registered")

    password_hash = hash_password(data.password)
    user = await self._repo.create(
        email=data.email,
        name=data.name,
        password_hash=password_hash,
    )
    return UserResponse.model_validate(user)


# Repository - data access
async def create(self, **data) -> User:
    doc = {**data, "created_at": datetime.now(UTC)}
    result = await self._collection.insert_one(doc)
    return self._to_entity({**doc, "_id": result.inserted_id})
```

---

## End-to-End Feature

Complete implementation of a "Products" feature.

### File Structure

```
app/products/
├── __init__.py
├── router.py
├── service.py
├── repository.py
├── schemas.py
├── models.py
├── dependencies.py
└── tests/
    ├── __init__.py
    ├── test_service.py
    └── test_router.py
```

### Models

```python
# app/products/models.py
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Product:
    id: str
    name: str
    price: float
    stock: int
    created_at: datetime
    updated_at: datetime
```

### Dependencies

```python
# app/products/dependencies.py
from typing import Annotated
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.cache.service import CacheService
from app.cache.dependencies import get_cache
from app.products.repository import ProductRepository
from app.products.service import ProductService


async def get_product_repository(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> ProductRepository:
    return ProductRepository(db)


async def get_product_service(
    repo: Annotated[ProductRepository, Depends(get_product_repository)],
    cache: Annotated[CacheService, Depends(get_cache)],
) -> ProductService:
    return ProductService(repo, cache)
```

### Test

```python
# app/products/tests/test_service.py
import pytest
from unittest.mock import AsyncMock

from app.products.service import ProductService
from app.core.exceptions import NotFoundError
from tests.factories import create_product


class TestProductService:
    @pytest.fixture
    def mock_repo(self):
        return AsyncMock()

    @pytest.fixture
    def mock_cache(self):
        cache = AsyncMock()
        cache.get.return_value = None
        return cache

    @pytest.fixture
    def service(self, mock_repo, mock_cache):
        return ProductService(mock_repo, mock_cache)

    async def test_find_by_id_returns_cached(self, service, mock_cache):
        product = create_product()
        mock_cache.get.return_value = product.__dict__

        result = await service.find_by_id(product.id)

        assert result.id == product.id
        mock_cache.get.assert_called_once()

    async def test_find_by_id_caches_on_miss(self, service, mock_repo, mock_cache):
        product = create_product()
        mock_cache.get.return_value = None
        mock_repo.find_by_id.return_value = product

        result = await service.find_by_id(product.id)

        assert result.id == product.id
        mock_cache.set.assert_called_once()

    async def test_find_by_id_raises_not_found(self, service, mock_repo):
        mock_repo.find_by_id.return_value = None

        with pytest.raises(NotFoundError):
            await service.find_by_id("nonexistent")
```

---

## Summary

| Layer | Responsibility | Example |
|-------|----------------|---------|
| Router | HTTP interface, validation | `router.py` |
| Service | Business logic | `service.py` |
| Repository | Data access | `repository.py` |
| Schemas | Input/output validation | `schemas.py` |
| Dependencies | DI wiring | `dependencies.py` |

Each layer only knows about the layer directly below it. Never skip layers.
