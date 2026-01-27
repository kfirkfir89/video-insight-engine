---
name: backend-node
description: Backend engineering principles for Node.js/TypeScript. How to think about architecture, not just what to build.
version: 2.0.0
---

# Backend Engineering Guidelines

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

## Core Principles

### SOLID - Why It Matters

**Single Responsibility**

> "A class should have only one reason to change"

WHY: When a class has multiple responsibilities, changes to one responsibility risk breaking the other. You end up touching the same file for unrelated reasons.

```
❌ UserService handles: auth, profile updates, email sending, reporting
   → Change email provider? Touch UserService
   → Change auth strategy? Touch UserService
   → Add profile field? Touch UserService
   → Everything breaks everything

✅ AuthService, ProfileService, EmailService, ReportService
   → Each changes for ONE reason
   → Changes are isolated
```

**Open/Closed**

> "Open for extension, closed for modification"

WHY: Every time you modify existing code, you risk breaking existing functionality. Extend instead.

```typescript
❌ Adding a new payment method requires editing PaymentService
   → if (type === 'stripe') ... else if (type === 'paypal') ...
   → Growing switch statements, growing risk

✅ PaymentProcessor interface, StripeProcessor, PayPalProcessor
   → New payment method = new class, existing code untouched
```

**Dependency Inversion**

> "Depend on abstractions, not concretions"

WHY: High-level business logic shouldn't know about low-level implementation details. This lets you swap implementations (for testing, for different environments, for new requirements).

```
❌ OrderService imports MongoOrderRepository directly
   → Can't test without MongoDB
   → Can't switch to Postgres without rewriting OrderService
   → Business logic tied to infrastructure

✅ OrderService depends on OrderRepository interface
   → Test with InMemoryOrderRepository
   → Production with MongoOrderRepository
   → Business logic doesn't know or care
```

---

### DRY - But Not Too DRY

> "Every piece of knowledge must have a single, unambiguous representation"

WHY: Duplication means bugs get fixed in one place but not another. Changes require hunting through the codebase.

**BUT: Wrong abstraction is worse than duplication.**

```
❌ Premature DRY
   Two endpoints both validate emails, so you make a shared validator
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

WHY: Complexity compounds. Every clever trick you add today becomes a debugging nightmare tomorrow. Code is read 10x more than written.

```typescript
❌ Clever
   const result = data?.items?.filter(Boolean).reduce((a, b) => ({...a, [b.id]: b}), {}) ?? {};

✅ Simple
   const itemsById = {};
   for (const item of data.items) {
     if (item) {
       itemsById[item.id] = item;
     }
   }
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
   → Every query now has tenant checks

✅ Build for today's requirements
   → If multi-tenancy becomes real, refactor then
   → You'll understand the problem better
   → The solution will fit the actual need
```

---

## Separation of Concerns

### The Golden Rule

**Each layer should have ONE job and know nothing about the layers above it.**

```
┌─────────────────────────────────────────┐
│                Routes                    │  Knows: HTTP, validation
│                                         │  Does: Parse request, return response
├─────────────────────────────────────────┤
│               Services                   │  Knows: Business rules
│                                         │  Does: Orchestrate, validate, decide
├─────────────────────────────────────────┤
│             Repositories                 │  Knows: Database
│                                         │  Does: CRUD, queries
└─────────────────────────────────────────┘
```

### Why This Matters

**Testing:** You can test business logic without HTTP. You can test data access without business rules.

**Changes:** Database changes don't affect business logic. API changes don't affect database layer.

**Readability:** When you open a file, you know what kind of code you'll find.

### DO ✅

```
• Route parses request, calls service, formats response
• Service contains business logic, calls repository
• Repository does database operations, nothing else
• Each layer has its own error types
• Dependencies flow DOWN only
```

### DON'T ❌

```
• Route contains SQL queries
• Service knows about HTTP status codes
• Repository makes business decisions
• Circular dependencies between layers
• Skip layers (route calls repository directly)
```

---

## Function-Level Design

### Small, Focused Functions

> "A function should do one thing and do it well"

WHY: Large functions hide bugs, are hard to test, and hard to understand.
Breaking them down makes each piece testable and reusable.

**Guidelines:**

| Metric     | Target | Max | Action if Exceeded         |
| ---------- | ------ | --- | -------------------------- |
| Lines      | 10-30  | 50  | Extract helper functions   |
| Nesting    | 1-2    | 3   | Use early returns          |
| Parameters | 3-4    | 5   | Use parameter object       |

### Guard Clauses (Early Returns)

WHY: Reduces nesting, makes the happy path obvious.

```typescript
// ❌ Deep nesting
function processOrder(order, user) {
  if (order) {
    if (user) {
      if (user.isActive) {
        if (order.total > 0) {
          // actual logic buried 4 levels deep
          return doSomething(order, user);
        }
      }
    }
  }
  return null;
}

// ✅ Guard clauses
function processOrder(order: Order, user: User): OrderResult {
  if (!order) throw new ValidationError("Order is required");
  if (!user) throw new ValidationError("User is required");
  if (!user.isActive) throw new ForbiddenError("User account is inactive");
  if (order.total <= 0) throw new ValidationError("Order total must be positive");

  // Happy path at top level - clear and obvious
  return doSomething(order, user);
}
```

### When to Extract a Function

- [ ] More than 30 lines? → Extract
- [ ] More than 2 levels of nesting? → Extract
- [ ] Need a comment to explain a block? → Extract into named function
- [ ] Same code appears 3+ times? → Extract
- [ ] Can be tested independently? → Extract

### Signs a Function is Too Complex

```typescript
// ❌ Too much going on
async function processVideo(videoId: string): Promise<VideoResult> {
  // 1. Fetch video
  const video = await db.videos.findOne({ _id: videoId });
  if (!video) throw new NotFoundError("Video not found");

  // 2. Download transcript
  let transcript = await fetchTranscript(video.url);
  if (!transcript) {
    transcript = await generateTranscript(video.url);
  }

  // 3. Generate summary
  const chunks = splitIntoChunks(transcript, 4000);
  const summaries = [];
  for (const chunk of chunks) {
    const summary = await llm.generate(chunk);
    summaries.push(summary);
  }

  // 4. Combine and save
  const finalSummary = combineSummaries(summaries);
  await db.summaries.insertOne({...});
  return new VideoResult(...);
}

// ✅ Decomposed into focused functions
async function processVideo(videoId: string): Promise<VideoResult> {
  const video = await getVideoOrThrow(videoId);
  const transcript = await getOrGenerateTranscript(video);
  const summary = await generateSummary(transcript);
  return await saveAndReturnResult(video, summary);
}
```

---

## Dependency Injection

### Why DI Exists

Not because it's a pattern. Because:

1. **Testability** - Mock dependencies, test in isolation
2. **Flexibility** - Swap implementations without changing consumers
3. **Clarity** - Dependencies are explicit, not hidden

### The Simple Version

```typescript
DON'T create dependencies inside your class:
  class UserService {
    private repo = new UserRepository();  // Hidden dependency!
  }

DO receive dependencies from outside:
  class UserService {
    constructor(private repo: UserRepository) {}  // Explicit!
  }
```

### When to Use DI

```
✅ External services (database, cache, API clients)
✅ Services that other services depend on
✅ Anything you want to mock in tests

❌ Pure utility functions (no state, no I/O)
❌ Value objects and DTOs
❌ Internal implementation details
```

---

## Error Handling Philosophy

### Fail Fast, Fail Loud

**Validate at the boundary, trust internally.**

```typescript
❌ Defensive programming everywhere
   function processUser(user) {
     if (!user) return null;           // Silent failure
     if (!user.email) return null;     // Error hidden
     if (!isValidEmail(user.email)) return null;
     // ... actual logic
   }

✅ Fail fast at the boundary
   // At API boundary
   const user = validateUserInput(req.body);  // Throws if invalid

   // Inside the system - trust validated data
   function processUser(user: ValidatedUser) {
     // user is guaranteed valid, just do the work
   }
```

### Error Categories

| Type       | What Went Wrong        | Who Should Know         | Action               |
| ---------- | ---------------------- | ----------------------- | -------------------- |
| Validation | Client sent bad data   | Client                  | 400, clear message   |
| Auth       | Client not authorized  | Client                  | 401/403              |
| Not Found  | Resource doesn't exist | Client                  | 404                  |
| Conflict   | Business rule violated | Client                  | 409                  |
| Internal   | Our code broke         | Us (logs), not client   | 500, generic message |
| External   | Third-party failed     | Us (logs), maybe client | 502/503, maybe retry |

### DO ✅

```
• Create domain-specific error classes
• Throw errors, don't return them
• Log errors with context (request ID, user ID)
• Never expose stack traces to clients
• Convert errors at layer boundaries
```

### DON'T ❌

```
• Catch and ignore (empty catch blocks)
• Return null for errors
• Log passwords, tokens, or sensitive data
• Use generic error messages internally
• Let database errors leak to clients
```

---

## Folder Structure

### Principles, Not Prescriptions

**Group by feature, not by type** (for most projects)

WHY: When you work on "users", you want all user-related files together. Not routes in one folder, services in another.

```
✅ Feature-based (recommended)
src/
├── users/
│   ├── user.route.ts
│   ├── user.service.ts
│   ├── user.repository.ts
│   └── user.test.ts
├── orders/
│   └── ...
└── shared/
    ├── errors/
    └── middleware/

❌ Type-based (avoid for large projects)
src/
├── routes/
│   ├── user.route.ts
│   └── order.route.ts
├── services/
│   ├── user.service.ts
│   └── order.service.ts
└── repositories/
    └── ...
```

### When Type-Based Works

Small projects (<10 files per type), utilities, shared infrastructure.

### The Test

Can you delete a feature by deleting one folder? If yes, you're organized by feature.

---

## Lazy Loading & Performance

### Load What You Need, When You Need It

```typescript
❌ Eager loading everything
const user = await getUser(id);           // Gets everything
   // user.posts loaded but never used
   // user.friends loaded but never used

✅ Load on demand
   const user = await getUser(id);           // Just user
   const posts = await getPosts(user.id);    // Only if needed
```

### Database Performance Rules

1. **Never fetch all** - Always paginate
2. **Select only needed fields** - Not `SELECT *`
3. **Index query fields** - No full table scans
4. **Avoid N+1** - Use joins or batch queries
5. **Measure before optimizing** - Profile, don't guess

---

## Testing Philosophy

### What to Test

```
✅ Business logic in services
✅ Edge cases and error paths
✅ Integration points (routes with mocked services)
✅ Complex utilities

❌ Framework code (Express, Fastify)
❌ Trivial getters/setters
❌ Implementation details
❌ Third-party libraries
```

### Test Isolation

```
Unit tests: Mock external dependencies
Integration tests: Real database (in memory or test container)
E2E tests: Real everything
```

### The Testing Trophy

More integration tests, fewer unit tests. Integration tests catch more real bugs.

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

```typescript
// ❌ ANTI-PATTERN: Route contains business logic
fastify.post("/orders", async (req, reply) => {
  const order = req.body;

  // Business logic in route!
  if (order.total > 1000) {
    order.discount = order.total * 0.1;
  }
  if (order.items.length > 10) {
    order.shipping = "free";
  }

  await db.orders.insertOne(order);
  return order;
});

// ✅ FIX: Route delegates to service
fastify.post("/orders", async (req, reply) => {
  const order = await orderService.create(req.body);
  return order;
});
```

```typescript
// ❌ ANTI-PATTERN: Service knows about HTTP
class OrderService {
  async create(data: CreateOrderInput) {
    if (!data.userId) {
      throw { statusCode: 400, message: "Missing userId" }; // HTTP leak!
    }
  }
}

// ✅ FIX: Service throws domain errors
class OrderService {
  async create(data: CreateOrderInput) {
    if (!data.userId) {
      throw new ValidationError("userId is required"); // Domain error
    }
  }
}
```

### Error Handling Anti-Patterns

```typescript
// ❌ ANTI-PATTERN: Swallowing errors
try {
  await saveUser(user);
} catch (error) {
  console.log("Error saving user"); // No details! Silent failure!
}

// ✅ FIX: Log with context, re-throw or handle properly
try {
  await saveUser(user);
} catch (error) {
  logger.error("Failed to save user", { userId: user.id, error });
  throw new InternalError("Failed to save user");
}
```

```typescript
// ❌ ANTI-PATTERN: Returning null for errors
async function findUser(id: string): Promise<User | null> {
  try {
    return await db.users.findOne({ _id: id });
  } catch (error) {
    return null; // Was it not found, or did the DB crash?!
  }
}

// ✅ FIX: Throw errors, return null only for "not found"
async function findUser(id: string): Promise<User | null> {
  const user = await db.users.findOne({ _id: id }); // Let errors throw
  return user; // null means "not found"
}
```

### Database Anti-Patterns

```typescript
// ❌ ANTI-PATTERN: N+1 queries
const users = await db.users.find().toArray();
for (const user of users) {
  user.orders = await db.orders.find({ userId: user._id }).toArray(); // N queries!
}

// ✅ FIX: Single query with aggregation or batch lookup
const users = await db.users
  .aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders",
      },
    },
  ])
  .toArray();
```

```typescript
// ❌ ANTI-PATTERN: Fetching everything
const allUsers = await db.users.find().toArray(); // 100k users in memory!

// ✅ FIX: Always paginate
const users = await db.users
  .find()
  .skip(page * limit)
  .limit(limit)
  .toArray();
```

### Async Anti-Patterns

```typescript
// ❌ ANTI-PATTERN: Sequential when could be parallel
const user = await getUser(id);
const orders = await getOrders(id);
const preferences = await getPreferences(id);
// 3 sequential calls = 3x latency

// ✅ FIX: Parallel with Promise.all
const [user, orders, preferences] = await Promise.all([
  getUser(id),
  getOrders(id),
  getPreferences(id),
]);
// Same result, 1/3 the time
```

```typescript
// ❌ ANTI-PATTERN: No timeout on external calls
const result = await externalApi.fetch(data); // Could hang forever!

// ✅ FIX: Always timeout external calls
const result = await Promise.race([
  externalApi.fetch(data),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 5000)
  ),
]);
```

### TypeScript Anti-Patterns

```typescript
// ❌ ANTI-PATTERN: any as escape hatch
function processData(data: any): any {
  return data.something.nested;
}

// ✅ FIX: Define types
interface InputData {
  something: { nested: string };
}
function processData(data: InputData): string {
  return data.something.nested;
}
```

```typescript
// ❌ ANTI-PATTERN: Type assertions to silence errors
const user = (await getUser()) as User; // Might be null!
console.log(user.name); // Potential runtime error

// ✅ FIX: Handle the types properly
const user = await getUser();
if (!user) {
  throw new NotFoundError("User not found");
}
console.log(user.name); // Now TypeScript knows it's safe
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
| Set up Fastify, routes, plugins, middleware  | [fastify.md](resources/fastify.md)                     |
| Build services, repositories, business logic | [services.md](resources/services.md)                   |
| Work with MongoDB, Mongoose, data modeling   | [mongodb.md](resources/mongodb.md)                     |
| Implement JWT auth, RBAC, security           | [auth.md](resources/auth.md)                           |
| Handle errors, logging, monitoring           | [errors.md](resources/errors.md)                       |
| Set up Redis, queues, Docker, infrastructure | [infrastructure.md](resources/infrastructure.md)       |
| Write unit, integration, E2E tests           | [testing.md](resources/testing.md)                     |
| Design REST APIs, versioning, OpenAPI        | [api-design.md](resources/api-design.md)               |
| Secure your API (OWASP, validation)          | [security.md](resources/security.md)                   |
| Call LLMs (OpenAI, Claude, streaming)        | [ai-integration.md](resources/ai-integration.md)       |
| Build AI apps (RAG, MCP, agents)             | [ai-patterns.md](resources/ai-patterns.md)             |
| Upload files (S3, validation, streaming)     | [file-uploads.md](resources/file-uploads.md)           |
| Real-time WebSockets (Socket.IO, rooms)      | [websockets.md](resources/websockets.md)               |
| See full working code examples               | [complete-examples.md](resources/complete-examples.md) |

---

## Project-Specific Documentation

For THIS project's specifics, see the docs/ folder:

| Need                | Reference                                                 |
| ------------------- | --------------------------------------------------------- |
| System architecture | [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)     |
| Data models         | [docs/DATA-MODELS.md](../../../docs/DATA-MODELS.md)       |
| API endpoints       | [docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md)   |
| Error handling      | [docs/ERROR-HANDLING.md](../../../docs/ERROR-HANDLING.md) |
| Security            | [docs/SECURITY.md](../../../docs/SECURITY.md)             |
