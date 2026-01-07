# Service & Repository Patterns

Business logic organization, dependency injection, and data access patterns.

---

## Service Layer

Services contain **business logic**. They don't know about HTTP or database drivers.

### DO ✅

```python
from app.users.repository import UserRepository
from app.users.schemas import UserCreate, UserUpdate
from app.users.models import User
from app.core.exceptions import NotFoundError, ConflictError
from app.core.security import hash_password


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self._repo = repository

    async def create(self, data: UserCreate) -> User:
        """Create a new user."""
        # Business rule: email uniqueness
        existing = await self._repo.find_by_email(data.email)
        if existing:
            raise ConflictError("Email already registered")

        # Business logic: hash password
        password_hash = hash_password(data.password)

        return await self._repo.create(
            email=data.email.lower(),
            name=data.name,
            password_hash=password_hash,
        )

    async def find_by_id(self, user_id: str) -> User:
        """Find user by ID."""
        user = await self._repo.find_by_id(user_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")
        return user

    async def update(self, user_id: str, data: UserUpdate) -> User:
        """Update user."""
        existing = await self._repo.find_by_id(user_id)
        if not existing:
            raise NotFoundError(f"User not found: {user_id}")

        # Business rule: email uniqueness
        if data.email and data.email != existing.email:
            email_taken = await self._repo.find_by_email(data.email)
            if email_taken:
                raise ConflictError("Email already in use")

        return await self._repo.update(user_id, data.model_dump(exclude_unset=True))
```

### DON'T ❌

```python
class UserService:
    async def create(self, request: Request):  # ❌ Knows about HTTP
        db = get_database()  # ❌ Creates own dependencies
        
        result = await db.users.insert_one({  # ❌ Raw DB access
            **request.json(),
            "created_at": datetime.now(),
        })

        return {"id": str(result.inserted_id)}  # ❌ Returns dict, not model
```

---

## Repository Layer

Repositories handle **data access**. They return domain objects, not database documents.

### DO ✅

```python
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

### DON'T ❌

```python
class UserRepository:
    async def find_by_id(self, user_id: str):
        return await self._collection.find_one({"_id": user_id})  # ❌ Returns raw doc
    
    async def create(self, data):
        return await self._collection.insert_one(data)  # ❌ Returns InsertOneResult
```

---

## Protocol for Interfaces

### DO ✅

```python
from typing import Protocol, runtime_checkable


@runtime_checkable
class UserRepositoryProtocol(Protocol):
    """Interface for user data access."""
    
    async def find_by_id(self, user_id: str) -> User | None: ...
    async def find_by_email(self, email: str) -> User | None: ...
    async def create(self, **data: Any) -> User: ...
    async def update(self, user_id: str, data: dict[str, Any]) -> User: ...


class UserService:
    def __init__(self, repository: UserRepositoryProtocol) -> None:
        self._repo = repository  # Depends on interface, not implementation
```

---

## Service Composition

### DO ✅

```python
class CheckoutService:
    def __init__(
        self,
        cart_service: CartService,
        inventory_service: InventoryService,
        payment_service: PaymentService,
        order_service: OrderService,
    ) -> None:
        self._cart = cart_service
        self._inventory = inventory_service
        self._payment = payment_service
        self._order = order_service

    async def checkout(self, user_id: str, payment_method: PaymentMethod) -> Order:
        """Process checkout with multiple services."""
        # Get cart
        cart = await self._cart.get_by_user(user_id)
        if not cart.items:
            raise BusinessError("Cart is empty")

        # Reserve inventory
        await self._inventory.reserve(cart.items)

        try:
            # Process payment
            payment = await self._payment.charge(user_id, cart.total, payment_method)

            # Create order
            order = await self._order.create(
                user_id=user_id,
                items=cart.items,
                payment_id=payment.id,
            )

            # Clear cart
            await self._cart.clear(user_id)

            return order
        except Exception:
            # Release inventory on failure
            await self._inventory.release(cart.items)
            raise
```

---

## Caching Pattern

### DO ✅

```python
class ProductService:
    CACHE_TTL = 3600  # 1 hour

    def __init__(
        self,
        repository: ProductRepository,
        cache: CacheService,
    ) -> None:
        self._repo = repository
        self._cache = cache

    async def find_by_id(self, product_id: str) -> Product:
        """Find product with caching."""
        cache_key = f"product:{product_id}"

        # Check cache
        cached = await self._cache.get(cache_key)
        if cached:
            return Product.model_validate(cached)

        # Fetch from DB
        product = await self._repo.find_by_id(product_id)
        if not product:
            raise NotFoundError(f"Product not found: {product_id}")

        # Cache result
        await self._cache.set(cache_key, product.model_dump(), self.CACHE_TTL)

        return product

    async def update(self, product_id: str, data: ProductUpdate) -> Product:
        """Update product and invalidate cache."""
        product = await self._repo.update(product_id, data)
        await self._cache.delete(f"product:{product_id}")
        return product
```

---

## Quick Reference

| Layer | Contains | Knows About | Returns |
|-------|----------|-------------|---------|
| Service | Business logic | Domain rules, other services | Domain objects |
| Repository | Data access | Database queries | Domain objects |

| Pattern | When to Use |
|---------|-------------|
| Service | Business logic, orchestration |
| Repository | Data access, query building |
| Protocol | Interface definition, decoupling |
| Composition | Complex multi-service operations |
