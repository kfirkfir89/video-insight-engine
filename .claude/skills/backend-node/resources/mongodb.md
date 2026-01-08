# MongoDB Patterns

Data modeling, queries, indexes, and Mongoose patterns.

---

## Connection Management

### DO ✅

```typescript
// Singleton connection with graceful handling
let client: MongoClient | null = null;

export async function connectDatabase(): Promise<MongoClient> {
  if (client) return client;

  client = new MongoClient(config.MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  
  // Verify connection
  await client.db().admin().ping();
  
  return client;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}

export function getDatabase(): Db {
  if (!client) {
    throw new Error('Database not connected');
  }
  return client.db(config.DB_NAME);
}
```

### DON'T ❌

```typescript
// New connection per request
app.get('/users', async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const users = await client.db().collection('users').find().toArray();
  await client.close();  // Connection overhead on every request!
  return users;
});
```

---

## Schema Design

### DO ✅

```typescript
// Document design - embed what's queried together
interface OrderDocument {
  _id: ObjectId;
  userId: ObjectId;
  status: 'pending' | 'paid' | 'shipped' | 'delivered';
  
  // Embedded - always needed with order
  items: Array<{
    productId: ObjectId;
    name: string;        // Denormalized for display
    price: number;       // Price at time of order
    quantity: number;
  }>;
  
  // Embedded - small, bounded
  shipping: {
    address: string;
    city: string;
    country: string;
  };
  
  // Reference - large, rarely needed
  invoiceId?: ObjectId;
  
  total: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### DON'T ❌

```typescript
// Over-normalized (too many joins)
interface OrderDocument {
  _id: ObjectId;
  userId: ObjectId;
  itemIds: ObjectId[];      // Requires separate query
  shippingAddressId: ObjectId;  // Another query
  // ...
}

// Under-normalized (unbounded arrays)
interface UserDocument {
  _id: ObjectId;
  orders: OrderDocument[];  // Can grow infinitely!
}
```

---

## Indexing

### DO ✅

```typescript
// Create indexes on startup
async function createIndexes(db: Db): Promise<void> {
  // Single field - for equality queries
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  
  // Compound - for queries that filter on multiple fields
  await db.collection('orders').createIndex({ userId: 1, createdAt: -1 });
  
  // Text - for search
  await db.collection('products').createIndex(
    { name: 'text', description: 'text' },
    { weights: { name: 10, description: 1 } }
  );
  
  // TTL - for auto-expiring documents
  await db.collection('sessions').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );
  
  // Partial - index only matching documents
  await db.collection('orders').createIndex(
    { status: 1 },
    { partialFilterExpression: { status: 'pending' } }
  );
}
```

### DON'T ❌

```typescript
// Index everything (wastes space, slows writes)
await collection.createIndex({ field1: 1 });
await collection.createIndex({ field2: 1 });
await collection.createIndex({ field3: 1 });
// 20 more indexes...

// Missing compound index (uses only first field)
// Query: { userId, status }
await collection.createIndex({ userId: 1 });  // status not indexed!
```

---

## Query Patterns

### DO ✅

```typescript
// Pagination with cursor (efficient)
async function findOrders(
  userId: string,
  cursor?: string,
  limit = 20
): Promise<{ items: Order[]; nextCursor?: string }> {
  const query: Filter<OrderDocument> = { userId: new ObjectId(userId) };
  
  if (cursor) {
    query._id = { $lt: new ObjectId(cursor) };
  }

  const docs = await collection
    .find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)  // Fetch one extra to check if more exist
    .toArray();

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit).map(toEntity);
  
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : undefined,
  };
}

// Projection - only fetch needed fields
const user = await collection.findOne(
  { _id: new ObjectId(id) },
  { projection: { email: 1, name: 1 } }  // Only these fields
);
```

### DON'T ❌

```typescript
// Skip-based pagination (slow for large offsets)
const page = 100;
const docs = await collection
  .find()
  .skip((page - 1) * 20)  // Scans 2000 documents!
  .limit(20)
  .toArray();

// Fetch all fields when only need one
const user = await collection.findOne({ _id });  // Gets everything
console.log(user.email);  // Only needed email
```

---

## Aggregation

### DO ✅

```typescript
// Use aggregation for complex queries
async function getOrderStats(userId: string): Promise<OrderStats> {
  const [result] = await collection.aggregate([
    { $match: { userId: new ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' },
      },
    },
  ]).toArray();

  return result ?? { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 };
}

// Pipeline stages for readability
const pipeline = [
  matchStage(userId),
  groupByMonthStage(),
  sortByDateStage(),
  projectStage(),
];
```

---

## Transactions

### DO ✅

```typescript
// Use transactions for multi-document operations
async function transferFunds(
  fromId: string,
  toId: string,
  amount: number
): Promise<void> {
  const session = client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Debit from source
      const from = await accounts.findOneAndUpdate(
        { _id: new ObjectId(fromId), balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session, returnDocument: 'after' }
      );
      
      if (!from) {
        throw new BusinessError('Insufficient funds');
      }

      // Credit to destination
      await accounts.updateOne(
        { _id: new ObjectId(toId) },
        { $inc: { balance: amount } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}
```

### DON'T ❌

```typescript
// No transaction - inconsistent state on failure
await accounts.updateOne({ _id: fromId }, { $inc: { balance: -amount } });
// If this fails, money disappears!
await accounts.updateOne({ _id: toId }, { $inc: { balance: amount } });
```

---

## Mongoose Patterns

### DO ✅

```typescript
// Schema with validation
const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 100,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
}, {
  timestamps: true,  // Adds createdAt, updatedAt
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
    },
  },
});

// Instance methods
userSchema.methods.comparePassword = async function(password: string) {
  return bcrypt.compare(password, this.passwordHash);
};

// Static methods
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};
```

---

## Quick Reference

| Pattern | When to Use |
|---------|-------------|
| Embed | Data queried together, bounded size |
| Reference | Large data, queried separately |
| Compound Index | Multi-field queries |
| Cursor Pagination | Large datasets |
| Aggregation | Complex queries, analytics |
| Transaction | Multi-document atomicity |

| Anti-Pattern | Problem |
|--------------|---------|
| Unbounded arrays | Document grows forever |
| Skip pagination | Slow at large offsets |
| Missing indexes | Full collection scans |
| Over-indexing | Slow writes, wasted space |
