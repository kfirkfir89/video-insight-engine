# Service & Repository Patterns

Business logic organization, dependency injection, and data access patterns.

<rules>
- ALWAYS inject dependencies via constructor — `__init__(self, repo: UserRepository)` (services that create their own dependencies cannot be tested in isolation)
- ALWAYS return domain entities or Pydantic models from services, never raw dicts (dicts lose type safety and autocompletion)
- ALWAYS use `Protocol` to define repository interfaces when services need to be testable with fakes (tight coupling to concrete repos prevents unit testing)
- NEVER import HTTP-related types (Request, HTTPException, status codes) in service files (services that know about HTTP cannot be reused outside web context)
- NEVER access the database directly from services — delegate to repositories (mixing data access and business logic violates single responsibility)
- NEVER create god services with 10+ methods — split by subdomain (large services become untestable and create merge conflicts)
</rules>

---

## Service Layer

Services contain business logic. They receive validated data, enforce rules, and delegate persistence.

```python
class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self._repo = repository

    async def create(self, data: UserCreate) -> User:
        existing = await self._repo.find_by_email(data.email)
        if existing:
            raise ConflictError("Email already registered")
        password_hash = hash_password(data.password)
        return await self._repo.create(
            email=data.email.lower(),
            name=data.name,
            password_hash=password_hash,
        )
```

---

## Repository Layer

Repositories handle data access. They return domain entities, not raw MongoDB documents.

```python
class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.users

    async def find_by_id(self, user_id: str) -> User | None:
        if not ObjectId.is_valid(user_id):
            return None
        doc = await self._collection.find_one({"_id": ObjectId(user_id)})
        return self._to_entity(doc) if doc else None

    def _to_entity(self, doc: dict) -> User:
        return User(id=str(doc["_id"]), email=doc["email"], ...)
```

---

## Protocol Interfaces

Define interfaces with `Protocol` so services depend on abstractions, not concrete implementations.

```python
@runtime_checkable
class UserRepositoryProtocol(Protocol):
    async def find_by_id(self, user_id: str) -> User | None: ...
    async def create(self, **data: Any) -> User: ...

class UserService:
    def __init__(self, repository: UserRepositoryProtocol) -> None:
        self._repo = repository  # Depends on interface
```

---

## Service Composition & Caching

Compose services by injecting other services. For caching, inject a `CacheService` and invalidate on writes.

```python
class ProductService:
    def __init__(self, repo: ProductRepository, cache: CacheService) -> None:
        self._repo = repo
        self._cache = cache

    async def find_by_id(self, product_id: str) -> Product:
        cached = await self._cache.get(f"product:{product_id}")
        if cached:
            return Product.model_validate(cached)
        product = await self._repo.find_by_id(product_id)
        if not product:
            raise NotFoundError(f"Product not found: {product_id}")
        await self._cache.set(f"product:{product_id}", product.model_dump(), 3600)
        return product
```

---

## Edge Cases

- **Circular service dependencies**: If ServiceA needs ServiceB and vice versa, extract the shared logic into a third service. Never use lazy imports to work around cycles.
- **Repository returning None vs raising**: Repositories return `None` for "not found." Services decide whether that is an error (raise NotFoundError) or expected (return None to caller).
- **Partial updates**: Use `data.model_dump(exclude_unset=True)` to only update fields the client actually sent, avoiding overwriting with defaults.

---

## Rules Summary

Services own business logic and throw domain exceptions. Repositories own data access and return domain entities. Dependencies are injected via constructors, never created internally. Use Protocol for interfaces to enable testing with fakes. Compose services for cross-domain operations. Cache at the service layer with explicit invalidation on writes. Keep services focused — one subdomain per service class.
