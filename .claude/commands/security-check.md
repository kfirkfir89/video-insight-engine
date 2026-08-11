# Security Check Command

Run a security audit on the codebase.

## Usage

```
/security-check [scope]
```

**Scope:**

- `all` - Full security audit (default)
- `auth` - Authentication & authorization
- `api` - API security (rate limiting, CORS)
- `data` - Data handling & validation

## Process

### 1. Load Security Documentation

Read [docs/SECURITY.md](../../docs/SECURITY.md) for requirements.

### 2. Check Authentication

- [ ] JWT_SECRET and JWT_REFRESH_SECRET are different
- [ ] Access token expires in 15 minutes
- [ ] Refresh token expires in 7 days
- [ ] Refresh token stored in HttpOnly cookie
- [ ] POST /auth/refresh endpoint exists
- [ ] POST /auth/logout clears cookie
- [ ] Password requirements enforced (8+ chars, upper/lower/number)

### 3. Check Rate Limiting

Per [docs/SECURITY.md](../../docs/SECURITY.md):

| Endpoint            | Required Limit    |
| ------------------- | ----------------- |
| POST /auth/register | 5/hour per IP     |
| POST /auth/login    | 10/15min per IP   |
| POST /auth/refresh  | 30/15min per IP   |
| POST /videos        | 10/day per user   |
| GET /explain/\*     | 60/hour per user  |
| POST /explain/chat  | 100/hour per user |

### 4. Check CORS Configuration

- [ ] Origin restricted to specific domains (not `*`)
- [ ] Credentials: true (for cookies)
- [ ] Only necessary methods allowed

### 5. Check Input Validation

- [ ] YouTube URL validation with regex
- [ ] Email validation
- [ ] Password validation
- [ ] All user inputs validated with Zod

### 6. Check Error Handling

Per [docs/ERROR-HANDLING.md](../../docs/ERROR-HANDLING.md):

- [ ] Consistent error response format
- [ ] No sensitive info leaked in errors
- [ ] All error codes documented

### 7. Check Environment

- [ ] No hardcoded secrets in code
- [ ] Secrets in .env (not committed)
- [ ] .env.example has all required vars

## Output

```
## Security Audit Report

### ✅ Passing
- [List of passing checks]

### ⚠️ Warnings
- [Non-critical issues]

### ❌ Failures
- [Critical security issues]

### Recommendations
- [Suggestions for improvement]
```

## Example

User: `/security-check auth`

Action:

1. Read docs/SECURITY.md
2. Check api/src/plugins/jwt.ts
3. Check api/src/routes/auth.routes.ts
4. Verify token configuration
5. Report findings
