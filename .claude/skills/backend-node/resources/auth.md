# Authentication & Authorization Patterns

JWT, password hashing, RBAC, and security best practices.

---

## Password Hashing

### DO ✅

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### DON'T ❌

```typescript
// Plain text storage
user.password = password;

// MD5/SHA1 (too fast, easily cracked)
user.password = crypto.createHash('md5').update(password).digest('hex');

// Low salt rounds (too fast)
bcrypt.hash(password, 4);
```

---

## JWT Tokens

### DO ✅

```typescript
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

interface TokenPayload {
  sub: string;      // User ID
  email: string;
  roles: string[];
  type: 'access' | 'refresh';
}

export function createAccessToken(user: User): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    type: 'access',
  };
  
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function createRefreshToken(user: User): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    type: 'refresh',
  };
  
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  
  if (payload.type !== 'access') {
    throw new UnauthorizedError('Invalid token type');
  }
  
  return payload;
}
```

### DON'T ❌

```typescript
// No expiry
jwt.sign(payload, secret);  // Lives forever!

// Same secret for all token types
jwt.sign({ type: 'refresh' }, ACCESS_SECRET);

// Sensitive data in payload
jwt.sign({ password: user.password, ssn: user.ssn }, secret);

// Weak secret
jwt.sign(payload, 'secret123');
```

---

## Authentication Middleware

### DO ✅

```typescript
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = request.headers.authorization;
  
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing authorization header');
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

// Usage in routes
app.get('/profile', {
  preHandler: [authenticate],
  handler: getProfile,
});
```

### DON'T ❌

```typescript
// Check auth in every handler
app.get('/profile', async (request) => {
  const token = request.headers.authorization?.slice(7);
  if (!token) throw new Error('No token');
  const user = jwt.verify(token, secret);
  // ... actual logic
});

app.get('/settings', async (request) => {
  const token = request.headers.authorization?.slice(7);  // Duplicated!
  // ...
});
```

---

## Role-Based Access Control (RBAC)

### DO ✅

```typescript
// Role hierarchy
const ROLE_HIERARCHY: Record<string, string[]> = {
  admin: ['admin', 'moderator', 'user'],
  moderator: ['moderator', 'user'],
  user: ['user'],
};

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest): Promise<void> => {
    const userRoles = request.user?.roles ?? [];
    
    // Check if any user role grants access
    const hasAccess = userRoles.some((userRole) => {
      const effectiveRoles = ROLE_HIERARCHY[userRole] ?? [userRole];
      return allowedRoles.some((allowed) => effectiveRoles.includes(allowed));
    });

    if (!hasAccess) {
      throw new ForbiddenError(`Requires role: ${allowedRoles.join(' or ')}`);
    }
  };
}

// Usage
app.delete('/users/:id', {
  preHandler: [authenticate, requireRole('admin')],
  handler: deleteUser,
});

app.post('/posts/:id/moderate', {
  preHandler: [authenticate, requireRole('moderator', 'admin')],
  handler: moderatePost,
});
```

### DON'T ❌

```typescript
// Check roles in handler
async function deleteUser(request: FastifyRequest) {
  if (!request.user.roles.includes('admin')) {
    throw new ForbiddenError();
  }
  // ... logic
}

// String comparison without hierarchy
if (user.role === 'admin') { ... }  // Admin can't do moderator stuff?
```

---

## Resource-Based Authorization

### DO ✅

```typescript
// Check ownership
export async function requireOwnership(
  request: FastifyRequest<{ Params: { id: string } }>
): Promise<void> {
  const resource = await resourceRepo.findById(request.params.id);
  
  if (!resource) {
    throw new NotFoundError();
  }

  const isOwner = resource.userId === request.user.sub;
  const isAdmin = request.user.roles.includes('admin');

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('Not authorized to access this resource');
  }

  // Attach to request for handler
  request.resource = resource;
}

// Usage
app.patch('/posts/:id', {
  preHandler: [authenticate, requireOwnership],
  handler: updatePost,
});
```

---

## Token Refresh Flow

### DO ✅

```typescript
// Refresh endpoint
app.post('/auth/refresh', async (request, reply) => {
  const { refreshToken } = request.body;

  // Verify refresh token
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Invalid token type');
  }

  // Check if token is revoked (store revoked tokens in Redis/DB)
  const isRevoked = await tokenStore.isRevoked(refreshToken);
  if (isRevoked) {
    throw new UnauthorizedError('Token has been revoked');
  }

  // Get fresh user data
  const user = await userService.findById(payload.sub);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Issue new tokens
  return {
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user),
  };
});
```

---

## Logout / Token Revocation

### DO ✅

```typescript
// Store revoked tokens until they expire
export class TokenStore {
  constructor(private readonly redis: Redis) {}

  async revoke(token: string, expiresIn: number): Promise<void> {
    // Store with TTL matching token expiry
    await this.redis.setex(`revoked:${token}`, expiresIn, '1');
  }

  async isRevoked(token: string): Promise<boolean> {
    const result = await this.redis.get(`revoked:${token}`);
    return result !== null;
  }
}

// Logout endpoint
app.post('/auth/logout', {
  preHandler: [authenticate],
  handler: async (request) => {
    const token = request.headers.authorization!.slice(7);
    
    // Revoke current access token
    await tokenStore.revoke(token, 15 * 60);  // 15 min TTL
    
    // Revoke refresh token if provided
    if (request.body.refreshToken) {
      await tokenStore.revoke(request.body.refreshToken, 7 * 24 * 60 * 60);
    }

    return { success: true };
  },
});
```

---

## Security Headers

### DO ✅

```typescript
import helmet from '@fastify/helmet';

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
});
```

---

## Quick Reference

| Pattern | When to Use |
|---------|-------------|
| JWT Access Token | Short-lived API authentication |
| JWT Refresh Token | Long-lived, stored securely |
| RBAC | Role-based permissions |
| Resource Auth | Owner/admin access checks |
| Token Revocation | Logout, password change |

| Security Rule | Implementation |
|---------------|----------------|
| Hash passwords | bcrypt, 12+ rounds |
| Short token expiry | 15m access, 7d refresh |
| Separate secrets | Different key per token type |
| Check token type | Prevent refresh as access |
| Revoke on logout | Store in Redis with TTL |
