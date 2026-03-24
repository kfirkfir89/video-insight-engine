# MongoDB Patterns

Data modeling, queries, indexes, aggregation, and transactions.

<rules>
- ALWAYS use a singleton connection with pool settings (`maxPoolSize`, `serverSelectionTimeoutMS`) (causes connection exhaustion if creating per-request)
- ALWAYS use cursor-based pagination for large datasets — fetch `limit + 1` to detect `hasMore` (causes O(n) scans if using skip-based)
- ALWAYS create compound indexes for multi-field queries — field order matters (causes full collection scans if missing)
- ALWAYS embed data that is queried together and bounded in size; reference data that grows unbounded or is queried separately (causes N+1 or document bloat if wrong)
- ALWAYS use projections to fetch only needed fields (causes unnecessary memory/network usage if fetching everything)
- NEVER use unbounded arrays in documents (causes document size to exceed 16MB limit)
- NEVER use `$where` with string interpolation (causes NoSQL injection)
</rules>

---

## Connection Management

```typescript
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
  await client.db().admin().ping();
  return client;
}
```

---

## Schema Design

Embed what's queried together (bounded). Reference what's large or independent:

```typescript
interface OrderDocument {
  _id: ObjectId;
  userId: ObjectId;
  items: Array<{
    productId: ObjectId;
    name: string;
    price: number;
    quantity: number;
  }>;
  shipping: { address: string; city: string; country: string }; // Embedded: small, bounded
  invoiceId?: ObjectId; // Reference: large, rarely needed
  total: number;
  createdAt: Date;
}
```

---

## Indexing

Create indexes at startup. Match query patterns with compound indexes:

```typescript
async function createIndexes(db: Db): Promise<void> {
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("orders").createIndex({ userId: 1, createdAt: -1 }); // Compound
  await db
    .collection("sessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
  await db.collection("orders").createIndex(
    { status: 1 },
    { partialFilterExpression: { status: "pending" } }, // Partial
  );
}
```

---

## Cursor Pagination

```typescript
async function findOrders(userId: string, cursor?: string, limit = 20) {
  const query: Filter<OrderDocument> = { userId: new ObjectId(userId) };
  if (cursor) query._id = { $lt: new ObjectId(cursor) };
  const docs = await collection
    .find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit).map(toEntity);
  return { items, nextCursor: hasMore ? items.at(-1)!.id : undefined };
}
```

---

## Aggregation & Transactions

Use aggregation for complex queries. Use transactions for multi-document atomicity:

```typescript
// Aggregation
const [result] = await collection
  .aggregate([
    { $match: { userId: new ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$total" },
      },
    },
  ])
  .toArray();

// Transaction
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    await accounts.findOneAndUpdate(
      { _id: new ObjectId(fromId), balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { session },
    );
    await accounts.updateOne(
      { _id: new ObjectId(toId) },
      { $inc: { balance: amount } },
      { session },
    );
  });
} finally {
  await session.endSession();
}
```

---

## Edge Cases

- **ObjectId validation**: Always check `ObjectId.isValid(id)` before constructing `new ObjectId(id)` — invalid strings throw.
- **Duplicate key on upsert**: MongoDB error code 11000 means unique constraint violation. Map to ConflictError in the error handler.
- **Read preference for analytics**: Use `readPreference: 'secondaryPreferred'` for aggregation pipelines that tolerate slight staleness.

---

## Rules Summary

Use a singleton MongoClient with connection pooling. Design documents by embedding bounded co-queried data and referencing unbounded or independent data. Create compound indexes that match query patterns (equality fields first, range/sort fields last). Always use cursor-based pagination with `limit + 1` to detect more pages. Use projections to fetch only needed fields. Use transactions for multi-document operations that must be atomic. Map MongoDB error code 11000 to ConflictError. Never use unbounded arrays or `$where` with string interpolation.
