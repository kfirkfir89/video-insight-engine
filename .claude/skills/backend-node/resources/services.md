# Service & Repository Patterns

Business logic organization, dependency injection, route handlers, and data access.

<rules>
- ALWAYS inject dependencies via constructor — services receive repos, other services, cache (causes untestable code if creating dependencies internally)
- ALWAYS throw domain errors from services (NotFoundError, ConflictError) — never return null or error objects (causes silent failures and inconsistent error handling)
- NEVER let services know about HTTP (no status codes, no request/reply objects) (causes leaked abstractions)
- NEVER let repositories contain business logic — they do CRUD and return domain entities (causes scattered business rules)
- ALWAYS convert DB documents to domain entities in repository's `toEntity()` method (causes DB schema leaking into business layer)
- ALWAYS use interface segregation — split large interfaces into Reader/Writer (causes unnecessary coupling)
- ALWAYS invalidate cache on mutation (update/delete) — set TTL on cache writes (causes stale data)
</rules>

---

## Layer Responsibilities

| Layer      | Contains                      | Knows About                  | Returns            |
| ---------- | ----------------------------- | ---------------------------- | ------------------ |
| Route      | Request/response mapping      | HTTP, calls service          | Formatted response |
| Service    | Business logic, orchestration | Domain rules, other services | Domain objects     |
| Repository | Data access, queries          | Database driver              | Domain objects     |

---

## Service Pattern

```typescript
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly inventoryService: InventoryService,
    private readonly emailService: EmailService,
  ) {}

  async createOrder(input: CreateOrderInput, userId: string): Promise<Order> {
    const available = await this.inventoryService.checkAvailability(
      input.items,
    );
    if (!available) throw new BusinessError("Items not available");
    const total = this.calculateTotal(input.items);
    const order = await this.orderRepo.create({
      userId,
      items: input.items,
      total,
      status: "pending",
    });
    this.emailService.sendOrderConfirmation(order).catch(console.error);
    return order;
  }
}
```

---

## Route Handler Pattern

There is no separate controller class in this repo — route handlers do the
request/response mapping directly and delegate to services (see `api/src/routes/`):

```typescript
export async function videoRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateVideoInput }>(
    "/videos",
    { schema: { body: createVideoSchema } },
    async (request, reply) => {
      const video = await fastify.container.videoService.create(
        request.user.id,
        request.body,
      );
      reply.status(201).send({ success: true, data: video });
    },
  );
}
```

---

## Repository Pattern

Repositories return domain entities, never raw DB documents:

```typescript
export class OrderRepository {
  constructor(private readonly collection: Collection<OrderDocument>) {}

  async findById(id: string): Promise<Order | null> {
    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? this.toEntity(doc) : null;
  }

  private toEntity(doc: OrderDocument): Order {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      items: doc.items,
      total: doc.total,
      status: doc.status,
      createdAt: doc.createdAt,
    };
  }
}
```

---

## DI Container

Wire dependencies in a container function:

```typescript
export function createOrderContainer(db: Database): OrderContainer {
  const orderRepo = new OrderRepository(db.collection("orders"));
  const inventoryService = new InventoryService(db.collection("inventory"));
  const emailService = new EmailService(config.EMAIL);
  const orderService = new OrderService(
    orderRepo,
    inventoryService,
    emailService,
  );
  return { orderRepo, inventoryService, emailService, orderService };
}
```

---

## Caching in Services

```typescript
async findById(id: string): Promise<Product> {
  const cached = await this.cache.get<Product>(`product:${id}`);
  if (cached) return cached;
  const product = await this.productRepo.findById(id);
  if (!product) throw new NotFoundError(`Product not found: ${id}`);
  await this.cache.set(`product:${id}`, product, 3600);
  return product;
}

async update(id: string, data: UpdateData): Promise<Product> {
  const product = await this.productRepo.update(id, data);
  await this.cache.delete(`product:${id}`); // Invalidate
  return product;
}
```

---

## Edge Cases

- **Service-to-service circular deps**: If ServiceA needs ServiceB and vice versa, extract the shared logic into a third service. Never use lazy imports to break cycles.
- **Fire-and-forget side effects**: Use `.catch(logger.error)` for non-critical async operations (email, analytics). Never `await` if the caller doesn't need the result.
- **findById returning null vs throwing**: Repositories return `null` (not found is a valid DB result). Services throw `NotFoundError` (business decision about required resources).

---

## Rules Summary

Services contain all business logic, receive dependencies via constructor injection, throw domain-specific errors, and never touch HTTP concepts. Route handlers map between HTTP requests and service calls, formatting the response envelope. Repositories encapsulate database access, convert documents to domain entities via `toEntity()`, and never make business decisions. Cache reads happen before DB lookups with TTL; cache invalidation happens on every mutation. DI wiring lives in container factory functions. Interface segregation splits large contracts into focused Reader/Writer interfaces for minimal coupling.
