# Service & Repository Patterns

Business logic organization, dependency injection, and data access patterns.

---

## Service Layer

Services contain **business logic**. They don't know about HTTP or database drivers.

### DO ✅

```typescript
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly inventoryService: InventoryService,
    private readonly emailService: EmailService
  ) {}

  async createOrder(input: CreateOrderInput, userId: string): Promise<Order> {
    // Business rule: check inventory
    const available = await this.inventoryService.checkAvailability(input.items);
    if (!available) {
      throw new BusinessError('Items not available');
    }

    // Business rule: calculate totals
    const total = this.calculateTotal(input.items);

    // Create order
    const order = await this.orderRepo.create({
      userId,
      items: input.items,
      total,
      status: 'pending',
    });

    // Side effect: send confirmation (fire and forget)
    this.emailService.sendOrderConfirmation(order).catch(console.error);

    return order;
  }

  private calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}
```

### DON'T ❌

```typescript
export class OrderService {
  async createOrder(req: FastifyRequest) {  // ❌ Knows about HTTP
    const db = getDatabase();  // ❌ Creates own dependencies
    
    const result = await db.collection('orders').insertOne({  // ❌ Raw DB access
      ...req.body,
      createdAt: new Date(),
    });

    return { id: result.insertedId };  // ❌ Returns DB-specific types
  }
}
```

---

## Repository Layer

Repositories handle **data access**. They return domain objects, not database documents.

### DO ✅

```typescript
export class OrderRepository {
  constructor(private readonly collection: Collection<OrderDocument>) {}

  async create(data: CreateOrderData): Promise<Order> {
    const doc = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this.collection.insertOne(doc);
    return this.toEntity({ ...doc, _id: result.insertedId });
  }

  async findById(id: string): Promise<Order | null> {
    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? this.toEntity(doc) : null;
  }

  // Convert DB document to domain entity
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

### DON'T ❌

```typescript
export class OrderRepository {
  async create(data: any) {
    return this.collection.insertOne(data);  // ❌ Returns DB result directly
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id });  // ❌ Returns document with _id
  }
}
```

---

## Dependency Injection

### Container Pattern

```typescript
// order.container.ts
export interface OrderContainer {
  orderRepository: OrderRepository;
  inventoryService: InventoryService;
  emailService: EmailService;
  orderService: OrderService;
}

export function createOrderContainer(db: Database): OrderContainer {
  const orderRepository = new OrderRepository(db.collection('orders'));
  const inventoryService = new InventoryService(db.collection('inventory'));
  const emailService = new EmailService(config.EMAIL);
  
  const orderService = new OrderService(
    orderRepository,
    inventoryService,
    emailService
  );

  return {
    orderRepository,
    inventoryService,
    emailService,
    orderService,
  };
}
```

### For Testing

```typescript
// Create with mocks
function createTestContainer(overrides = {}): OrderContainer {
  return {
    orderRepository: createMockRepo(),
    inventoryService: createMockInventory(),
    emailService: createMockEmail(),
    orderService: null!, // Will be created with mocks
    ...overrides,
  };
}
```

---

## Interface Segregation

### DO ✅

```typescript
// Small, focused interfaces
interface OrderReader {
  findById(id: string): Promise<Order | null>;
  findByUser(userId: string): Promise<Order[]>;
}

interface OrderWriter {
  create(data: CreateOrderData): Promise<Order>;
  update(id: string, data: UpdateOrderData): Promise<Order>;
}

// Service only depends on what it needs
class OrderReportService {
  constructor(private readonly orders: OrderReader) {}  // Only needs read
}

class OrderProcessingService {
  constructor(private readonly orders: OrderWriter) {}  // Only needs write
}
```

### DON'T ❌

```typescript
// Giant interface
interface OrderRepository {
  findById(id: string): Promise<Order>;
  findByUser(userId: string): Promise<Order[]>;
  findByStatus(status: string): Promise<Order[]>;
  create(data: any): Promise<Order>;
  update(id: string, data: any): Promise<Order>;
  delete(id: string): Promise<void>;
  archive(id: string): Promise<void>;
  // 20 more methods...
}

// Every consumer depends on everything
```

---

## Error Handling in Services

### DO ✅

```typescript
class UserService {
  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    
    // Throw domain error, not null
    if (!user) {
      throw new NotFoundError(`User not found: ${id}`);
    }
    
    return user;
  }

  async updateEmail(userId: string, newEmail: string): Promise<User> {
    // Check business rules
    const existing = await this.userRepo.findByEmail(newEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictError('Email already in use');
    }

    return this.userRepo.update(userId, { email: newEmail });
  }
}
```

### DON'T ❌

```typescript
class UserService {
  async findById(id: string): Promise<User | null> {  // ❌ Returns null
    return this.userRepo.findById(id);
  }

  async updateEmail(userId: string, newEmail: string) {
    const existing = await this.userRepo.findByEmail(newEmail);
    if (existing) {
      return { success: false, error: 'Email taken' };  // ❌ Returns error object
    }
    // ...
  }
}
```

---

## Service Composition

### DO ✅

```typescript
// Compose services for complex operations
class CheckoutService {
  constructor(
    private readonly cart: CartService,
    private readonly inventory: InventoryService,
    private readonly payment: PaymentService,
    private readonly order: OrderService
  ) {}

  async checkout(userId: string, paymentMethod: PaymentMethod): Promise<Order> {
    // Get cart
    const cart = await this.cart.getByUser(userId);
    if (cart.items.length === 0) {
      throw new BusinessError('Cart is empty');
    }

    // Reserve inventory
    await this.inventory.reserve(cart.items);

    try {
      // Process payment
      const payment = await this.payment.charge(userId, cart.total, paymentMethod);

      // Create order
      const order = await this.order.create({
        userId,
        items: cart.items,
        paymentId: payment.id,
      });

      // Clear cart
      await this.cart.clear(userId);

      return order;
    } catch (error) {
      // Release inventory on failure
      await this.inventory.release(cart.items);
      throw error;
    }
  }
}
```

---

## Caching in Services

### DO ✅

```typescript
class ProductService {
  private readonly CACHE_TTL = 3600;

  constructor(
    private readonly productRepo: ProductRepository,
    private readonly cache: CacheService
  ) {}

  async findById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    
    // Check cache
    const cached = await this.cache.get<Product>(cacheKey);
    if (cached) return cached;

    // Fetch from DB
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError(`Product not found: ${id}`);
    }

    // Cache for next time
    await this.cache.set(cacheKey, product, this.CACHE_TTL);
    
    return product;
  }

  async update(id: string, data: UpdateProductData): Promise<Product> {
    const product = await this.productRepo.update(id, data);
    
    // Invalidate cache
    await this.cache.delete(`product:${id}`);
    
    return product;
  }
}
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
| Container | Wiring dependencies |
| Interface | Decoupling, testability |
