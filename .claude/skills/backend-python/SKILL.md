---
name: backend-python
description: Backend engineering principles for Python/FastAPI. How to think about architecture, not just what to build.
version: 2.0.0
---

# Backend Engineering Guidelines (Python)

This skill teaches you to THINK like a principal engineer, not just copy patterns.

---

## The Principal Engineer Mindset

Before writing any code, ask yourself:

1. **What problem am I actually solving?** Not "I need a service" but "I need to isolate this business logic so it can be tested and reused"

2. **What will change?** Code that changes together should live together. Code that changes for different reasons should be separated.

3. **What can go wrong?** Every external call can fail. Every input can be invalid. Design for failure, not just success.

4. **Who maintains this after me?** If a junior dev can't understand it in 5 minutes, it's too clever.

5. **How do I know it works?** If you can't test it easily, you've designed it wrong.

---

## The Zen of Python (Applied)

```python
import this
```

| Principle                                 | Application                        |
| ----------------------------------------- | ---------------------------------- |
| Beautiful is better than ugly             | Clean, readable code               |
| Explicit is better than implicit          | Type hints, clear names, no magic  |
| Simple is better than complex             | KISS principle                     |
| Flat is better than nested                | Avoid deep nesting                 |
| Readability counts                        | Code is read 10x more than written |
| Errors should never pass silently         | Never swallow exceptions           |
| In the face of ambiguity, refuse to guess | Validate inputs, fail fast         |
| There should be one obvious way           | Consistent patterns                |

---

## Core Principles

### SOLID - Why It Matters

**Single Responsibility**

> "A class should have only one reason to change"

WHY: When a class has multiple responsibilities, changes to one risk breaking the other.

```
❌ UserService handles: auth, profile updates, email sending, reporting
   → Change email provider? Touch UserService
   → Change auth strategy? Touch UserService
   → Everything breaks everything

✅ AuthService, ProfileService, EmailService, ReportService
   → Each changes for ONE reason
   → Changes are isolated
```

**Open/Closed**

> "Open for extension, closed for modification"

WHY: Every time you modify existing code, you risk breaking existing functionality.

```python
❌ Adding payment method requires editing PaymentService
   → if payment_type == "stripe": ... elif payment_type == "paypal": ...
   → Growing if-chains, growing risk

✅ PaymentProcessor Protocol, StripeProcessor, PayPalProcessor
   → New payment = new class, existing code untouched
```

**Dependency Inversion**

> "Depend on abstractions, not concretions"

WHY: High-level business logic shouldn't know about low-level implementation details.

```
❌ OrderService imports MongoOrderRepository directly
   → Can't test without MongoDB
   → Can't switch to Postgres without rewriting

✅ OrderService depends on OrderRepository Protocol
   → Test with InMemoryOrderRepository
   → Production with MongoOrderRepository
   → Business logic doesn't know or care
```

---

### DRY - But Not Too DRY

> "Every piece of knowledge must have a single, unambiguous representation"

WHY: Duplication means bugs get fixed in one place but not another.

**BUT: Wrong abstraction is worse than duplication.**

```
❌ Premature DRY
   Two endpoints validate emails, so you make shared validator
   Later, one needs different rules
   Now your "shared" code has if-statements for each case
   Worse than duplication

✅ Wait for the pattern
   See the same code 3 times?
   NOW extract it
   You understand the real abstraction
```

**Rule of Three:** Duplicate once is okay. Duplicate twice, consider abstracting. Duplicate three times, definitely abstract.

---

### KISS - Complexity Is the Enemy

> "Keep it simple, stupid"

WHY: Complexity compounds. Every clever trick becomes a debugging nightmare.

```python
# ❌ Clever
result = {item.id: item for item in (x for x in data if x and x.active) if item.id}

# ✅ Simple
result = {}
for item in data:
    if item and item.active and item.id:
        result[item.id] = item
```

**Signs you're being too clever:**

- You need comments to explain what it does
- You had to think hard to write it
- You're proud of how short it is
- A colleague asks "what does this do?"

---

### YAGNI - Resist the Future

> "You aren't gonna need it"

WHY: Features you build "just in case" become code you maintain forever. 50% of "future requirements" never materialize.

```
❌ "We might need multi-tenancy later"
   → Weeks of work on tenant isolation
   → Never used, but maintained forever

✅ Build for today's requirements
   → If multi-tenancy becomes real, refactor then
   → You'll understand the problem better
```

---

## Separation of Concerns

### The Golden Rule

**Each layer should have ONE job and know nothing about the layers above it.**

```
┌─────────────────────────────────────────┐
│              Routes                      │  Knows: HTTP, Pydantic schemas
│                                         │  Does: Parse request, return response
├─────────────────────────────────────────┤
│             Services                     │  Knows: Business rules
│                                         │  Does: Orchestrate, validate, decide
├─────────────────────────────────────────┤
│           Repositories                   │  Knows: Database
│                                         │  Does: CRUD, queries
└─────────────────────────────────────────┘
```

### Why This Matters

**Testing:** Test business logic without HTTP. Test data access without business rules.

**Changes:** Database changes don't affect business logic. API changes don't affect database layer.

**Readability:** When you open a file, you know what kind of code you'll find.

### DO ✅

```
• Route parses request, calls service, formats response
• Service contains business logic, calls repository
• Repository does database operations, nothing else
• Each layer has its own error types
• Dependencies flow DOWN only (use Depends())
```

### DON'T ❌

```
• Route contains database queries
• Service knows about HTTP status codes
• Repository makes business decisions
• Circular imports between layers
• Skip layers (route calls repository directly)
```

---

## Dependency Injection (FastAPI Style)

### Why DI Exists

1. **Testability** - Mock dependencies, test in isolation
2. **Flexibility** - Swap implementations without changing consumers
3. **Clarity** - Dependencies are explicit via `Depends()`

### DO ✅

```python
# Explicit dependencies via Depends()
async def get_user_service(
    repo: Annotated[UserRepository, Depends(get_user_repo)]
) -> UserService:
    return UserService(repo)

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    service: Annotated[UserService, Depends(get_user_service)]
) -> UserResponse:
    return await service.find_by_id(user_id)
```

### DON'T ❌

```python
# Hidden dependencies
class UserService:
    def __init__(self):
        self.repo = UserRepository()  # Hidden! Can't mock!

# Global singletons
from app.database import db  # Tight coupling
```

---

## Type Hints Philosophy

### DO ✅

```python
# Type ALL function signatures
def get_user(user_id: str) -> User: ...

# Use | for optionals (Python 3.10+)
def find(id: str) -> User | None: ...

# Use Annotated for metadata
user_id: Annotated[str, Path(description="User ID")]

# Use Protocol for duck typing
class Repository(Protocol):
    async def find_by_id(self, id: str) -> Model | None: ...
```

### DON'T ❌

```python
# Any everywhere
def process(data: Any) -> Any: ...

# Ignore type errors
result = sketchy_function()  # type: ignore

# No types at all
def get_user(user_id):
    return db.find(user_id)
```

---

## Async Patterns

### When to Use Async

```
✅ I/O bound operations (DB, HTTP, files)
✅ Multiple independent operations
✅ WebSocket connections

❌ CPU-bound operations (use multiprocessing)
❌ Simple CRUD with one DB call (async overhead)
❌ When all deps are sync anyway
```

### DO ✅

```python
# Parallel I/O with gather
results = await asyncio.gather(
    fetch_user(user_id),
    fetch_orders(user_id),
    fetch_preferences(user_id),
)

# Timeouts on external calls
async with asyncio.timeout(5.0):
    result = await external_api.call()

# Use httpx for async HTTP
async with httpx.AsyncClient() as client:
    response = await client.get(url)
```

### DON'T ❌

```python
# Blocking in async context
await asyncio.to_thread(requests.get, url)  # Use httpx instead!

# time.sleep in async
time.sleep(1)  # Blocks event loop! Use asyncio.sleep()

# Missing await
result = async_function()  # Returns coroutine, not result!
```

---

## Error Handling Philosophy

### Fail Fast, Fail Loud

**Validate at the boundary (Pydantic), trust internally.**

```python
# ❌ Defensive everywhere
def process_user(user):
    if not user:
        return None
    if not user.email:
        return None
    # ... actual logic

# ✅ Fail fast at boundary
@router.post("/users")
async def create_user(data: CreateUserInput):  # Pydantic validates
    return await service.create(data)  # Trust validated data
```

### Error Categories

| Type              | Status | When                      |
| ----------------- | ------ | ------------------------- |
| ValidationError   | 422    | Invalid input (Pydantic)  |
| UnauthorizedError | 401    | Missing/invalid auth      |
| ForbiddenError    | 403    | Valid auth, no permission |
| NotFoundError     | 404    | Resource doesn't exist    |
| ConflictError     | 409    | Duplicate, constraint     |
| BusinessError     | 422    | Business rule violated    |
| InternalError     | 500    | Unexpected server error   |

---

## Folder Structure

### Feature-Based (Recommended)

```
app/
├── users/
│   ├── __init__.py
│   ├── router.py
│   ├── service.py
│   ├── repository.py
│   ├── schemas.py
│   ├── models.py
│   └── tests/
├── orders/
│   └── ...
├── core/
│   ├── config.py
│   ├── exceptions.py
│   ├── security.py
│   └── database.py
└── main.py
```

**Why:** Everything for a feature is together. Easy to find, easy to delete.

### The Test

Can you delete a feature by deleting one folder? If yes, you're organized right.

---

## Quick Decision Guide

### Should I Create a New Service?

- [ ] Logic used by multiple routes? → YES
- [ ] Complex business rules? → YES
- [ ] Needs independent testing? → YES
- [ ] Just CRUD with no logic? → NO, keep in repository

### Should I Extract This Code?

- [ ] Used in 3+ places? → YES
- [ ] Will change independently? → YES
- [ ] Just similar-looking code? → WAIT, might be coincidence

### Should I Add This Feature?

- [ ] Solves a current problem? → YES
- [ ] "Might need it later"? → NO
- [ ] Makes other features easier? → MAYBE, be careful

---

## Common Anti-Patterns to Avoid

### Architecture Anti-Patterns

```python
# ❌ ANTI-PATTERN: Route contains business logic
@router.post("/orders")
async def create_order(data: CreateOrderInput):
    order = data.model_dump()

    # Business logic in route!
    if order["total"] > 1000:
        order["discount"] = order["total"] * 0.1
    if len(order["items"]) > 10:
        order["shipping"] = "free"

    await db.orders.insert_one(order)
    return order

# ✅ FIX: Route delegates to service
@router.post("/orders")
async def create_order(
    data: CreateOrderInput,
    service: Annotated[OrderService, Depends(get_order_service)]
):
    return await service.create(data)
```

```python
# ❌ ANTI-PATTERN: Service knows about HTTP
class OrderService:
    async def create(self, data: CreateOrderInput):
        if not data.user_id:
            raise HTTPException(status_code=400, detail="Missing user_id")  # HTTP leak!

# ✅ FIX: Service throws domain errors
class OrderService:
    async def create(self, data: CreateOrderInput):
        if not data.user_id:
            raise ValidationError("user_id is required")  # Domain error
```

### Error Handling Anti-Patterns

```python
# ❌ ANTI-PATTERN: Bare except
try:
    await save_user(user)
except:  # Catches EVERYTHING including KeyboardInterrupt!
    pass  # Silent failure!

# ✅ FIX: Catch specific exceptions, log with context
try:
    await save_user(user)
except DatabaseError as e:
    logger.error("Failed to save user", user_id=user.id, error=str(e))
    raise InternalError("Failed to save user")
```

```python
# ❌ ANTI-PATTERN: Returning None for errors
async def find_user(user_id: str) -> User | None:
    try:
        return await db.users.find_one({"_id": user_id})
    except Exception:
        return None  # Was it not found, or did DB crash?!

# ✅ FIX: Let exceptions propagate, None = not found
async def find_user(user_id: str) -> User | None:
    return await db.users.find_one({"_id": user_id})  # Errors throw, None = not found
```

### Async Anti-Patterns

```python
# ❌ ANTI-PATTERN: Blocking in async context
import requests  # Blocking library!

async def fetch_external():
    response = requests.get(url)  # BLOCKS EVENT LOOP!
    return response.json()

# ✅ FIX: Use async libraries
import httpx

async def fetch_external():
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()
```

```python
# ❌ ANTI-PATTERN: Sequential when could be parallel
user = await get_user(id)
orders = await get_orders(id)
preferences = await get_preferences(id)
# 3 sequential calls = 3x latency

# ✅ FIX: Parallel with gather
user, orders, preferences = await asyncio.gather(
    get_user(id),
    get_orders(id),
    get_preferences(id),
)
```

```python
# ❌ ANTI-PATTERN: time.sleep in async code
import time
time.sleep(1)  # BLOCKS EVENT LOOP!

# ✅ FIX: Use asyncio.sleep
import asyncio
await asyncio.sleep(1)  # Non-blocking
```

### Database Anti-Patterns

```python
# ❌ ANTI-PATTERN: N+1 queries
users = await db.users.find().to_list(None)
for user in users:
    user["orders"] = await db.orders.find({"user_id": user["_id"]}).to_list(None)
    # N additional queries!

# ✅ FIX: Aggregation pipeline
users = await db.users.aggregate([
    {"$lookup": {
        "from": "orders",
        "localField": "_id",
        "foreignField": "user_id",
        "as": "orders"
    }}
]).to_list(None)
```

```python
# ❌ ANTI-PATTERN: Loading everything into memory
all_users = await db.users.find().to_list(None)  # 100k users in RAM!

# ✅ FIX: Always paginate or stream
users = await db.users.find().skip(page * limit).limit(limit).to_list(limit)

# Or stream for processing
async for user in db.users.find():
    await process_user(user)
```

### Pydantic Anti-Patterns

```python
# ❌ ANTI-PATTERN: Dict everywhere
async def create_user(data: dict) -> dict:
    # No validation, no autocompletion, runtime errors
    return {"id": data["id"], "name": data["name"]}

# ✅ FIX: Pydantic models
class CreateUserInput(BaseModel):
    name: str
    email: EmailStr

class UserResponse(BaseModel):
    id: str
    name: str
    email: str

async def create_user(data: CreateUserInput) -> UserResponse:
    # Validated, typed, documented
    ...
```

```python
# ❌ ANTI-PATTERN: Optional everything
class UserInput(BaseModel):
    name: str | None = None
    email: str | None = None
    age: int | None = None
    # Nothing required = bugs waiting to happen

# ✅ FIX: Required by default
class UserInput(BaseModel):
    name: str  # Required
    email: EmailStr  # Required and validated
    age: int | None = None  # Only this is truly optional
```

---

## Related Resources

When working on specific topics, these resources work together:

| Topic              | Primary                                          | Also Read                                                                    |
| ------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Authentication     | [auth.md](resources/auth.md)                     | [security.md](resources/security.md), [errors.md](resources/errors.md)       |
| AI Integration     | [ai-integration.md](resources/ai-integration.md) | [ai-patterns.md](resources/ai-patterns.md), [errors.md](resources/errors.md) |
| Real-time Features | [websockets.md](resources/websockets.md)         | [infrastructure.md](resources/infrastructure.md)                             |
| File Handling      | [file-uploads.md](resources/file-uploads.md)     | [security.md](resources/security.md)                                         |
| Testing            | [testing.md](resources/testing.md)               | [services.md](resources/services.md), [mongodb.md](resources/mongodb.md)     |

---

## Resource Files

For implementation details on specific technologies:

| Need to...                                   | Read this                                              |
| -------------------------------------------- | ------------------------------------------------------ |
| Set up FastAPI, routes, middleware           | [fastapi.md](resources/fastapi.md)                     |
| Build services, repositories, business logic | [services.md](resources/services.md)                   |
| Work with MongoDB, Motor, Beanie             | [mongodb.md](resources/mongodb.md)                     |
| Implement JWT auth, RBAC                     | [auth.md](resources/auth.md)                           |
| Handle errors, logging, monitoring           | [errors.md](resources/errors.md)                       |
| Set up Redis, Celery, Docker                 | [infrastructure.md](resources/infrastructure.md)       |
| Write unit, integration, E2E tests           | [testing.md](resources/testing.md)                     |
| Design REST APIs, versioning, OpenAPI        | [api-design.md](resources/api-design.md)               |
| Secure your API (OWASP, validation)          | [security.md](resources/security.md)                   |
| Call LLMs (OpenAI, Claude, streaming)        | [ai-integration.md](resources/ai-integration.md)       |
| Build AI apps (RAG, MCP, agents)             | [ai-patterns.md](resources/ai-patterns.md)             |
| Upload files (S3, validation, streaming)     | [file-uploads.md](resources/file-uploads.md)           |
| Real-time WebSockets (rooms, presence)       | [websockets.md](resources/websockets.md)               |
| See full working code examples               | [complete-examples.md](resources/complete-examples.md) |

---

## Project-Specific Documentation

For THIS project's specifics, see the docs/ folder:

| Need                | Reference                                                 |
| ------------------- | --------------------------------------------------------- |
| System architecture | [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)     |
| Data models         | [docs/DATA-MODELS.md](../../../docs/DATA-MODELS.md)       |
| API endpoints       | [docs/API-REST.md](../../../docs/API-REST.md)             |
| Error handling      | [docs/ERROR-HANDLING.md](../../../docs/ERROR-HANDLING.md) |
| Security            | [docs/SECURITY.md](../../../docs/SECURITY.md)             |
