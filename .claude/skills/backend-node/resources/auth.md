# Authentication & Authorization

JWT tokens, password hashing, RBAC, resource ownership, and token lifecycle.

<rules>
- ALWAYS hash passwords with bcrypt at 12+ salt rounds (causes brute-force vulnerability if using MD5/SHA1/low rounds)
- ALWAYS use separate secrets for access and refresh tokens (causes token type confusion attacks if shared)
- ALWAYS set short expiry on access tokens (15m) and longer on refresh tokens (7d) (causes permanent access if no expiry)
- ALWAYS verify token type field — reject refresh tokens used as access tokens (causes authorization bypass)
- ALWAYS use `preHandler` hooks for auth — never duplicate auth checks in handlers (causes missed checks and duplication)
- NEVER store sensitive data (passwords, SSN) in JWT payload (causes data exposure — JWTs are base64, not encrypted)
- NEVER check roles with string equality — use role hierarchy with effective roles (causes permission gaps)
</rules>

---

## Password Hashing

```typescript
import bcrypt from "bcrypt";
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash); // Already timing-safe
}
```

---

## JWT Token Pair

```typescript
interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  type: "access" | "refresh";
}

export function createAccessToken(user: User): string {
  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    type: "access",
  };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: "15m" });
}

export function createRefreshToken(user: User): string {
  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    type: "refresh",
  };
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  if (payload.type !== "access")
    throw new UnauthorizedError("Invalid token type");
  return payload;
}
```

---

## Auth Middleware & RBAC

```typescript
export async function authenticate(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer "))
    throw new UnauthorizedError("Missing authorization");
  try {
    request.user = verifyAccessToken(header.slice(7));
  } catch (e) {
    throw new UnauthorizedError(
      e instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token",
    );
  }
}

const ROLE_HIERARCHY: Record<string, string[]> = {
  admin: ["admin", "moderator", "user"],
  moderator: ["moderator", "user"],
  user: ["user"],
};
export function requireRole(...allowed: string[]) {
  return async (request: FastifyRequest): Promise<void> => {
    const hasAccess = request.user?.roles.some((role) =>
      (ROLE_HIERARCHY[role] ?? [role]).some((r) => allowed.includes(r)),
    );
    if (!hasAccess)
      throw new ForbiddenError(`Requires role: ${allowed.join(" or ")}`);
  };
}
```

---

## Resource Ownership

```typescript
export async function requireOwnership(
  request: FastifyRequest<{ Params: { id: string } }>,
): Promise<void> {
  const resource = await resourceRepo.findById(request.params.id);
  if (!resource) throw new NotFoundError();
  const isOwner = resource.userId === request.user.sub;
  if (!isOwner && !request.user.roles.includes("admin"))
    throw new ForbiddenError("Not authorized");
  request.resource = resource;
}
```

---

## Token Refresh & Revocation

Store revoked tokens in Redis with TTL matching token expiry. On refresh, check revocation list, verify token type is `refresh`, get fresh user data, issue new pair. On logout, revoke both tokens.

```typescript
export class TokenStore {
  constructor(private readonly redis: Redis) {}
  async revoke(token: string, expiresIn: number) {
    await this.redis.setex(`revoked:${token}`, expiresIn, "1");
  }
  async isRevoked(token: string): Promise<boolean> {
    return (await this.redis.get(`revoked:${token}`)) !== null;
  }
}
```

---

## Edge Cases

- **Token expired during long request**: The auth middleware runs at request start. If processing takes >15m and the token expires mid-request, the request still completes — expiry is checked only at auth time.
- **Role changes not reflected**: JWT payload contains roles at issuance time. If an admin demotes a user, the old access token still works until it expires. Keep access token expiry short (15m) to limit this window.
- **Refresh token rotation**: On each refresh, revoke the old refresh token and issue a new one. If a revoked refresh token is reused, revoke ALL tokens for that user (potential theft).

---

## Rules Summary

Hash passwords with bcrypt (12+ rounds), never store sensitive data in JWT payloads. Use separate secrets for access (15m) and refresh (7d) tokens, always verifying the token type field. Auth middleware runs as a preHandler hook, extracting the user payload onto `request.user`. RBAC uses a role hierarchy — `requireRole()` checks effective roles, not direct string equality. Resource ownership checks happen in preHandler hooks that attach the resource to the request. Revoked tokens are stored in Redis with TTL matching their original expiry.
