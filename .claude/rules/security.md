# Security Rules

<rules>
- NEVER hardcode secrets, API keys, or passwords — use environment variables (exposed secrets = full system compromise)
- ALWAYS validate ALL user input and sanitize before database queries (prevents injection attacks)
- ALWAYS use parameterized queries — never string concatenation for queries (SQL/NoSQL injection vector)
- NEVER expose stack traces, internal paths, or structure to users (information disclosure enables targeted attacks)
- NEVER log sensitive information — API keys, passwords, PII, tokens (log exposure = credential leak)
- ALWAYS verify auth on every protected route and check permissions at the data layer (route-only auth is bypassable)
- ALWAYS configure CORS properly — never `*` in production (allows cross-origin attacks)
- ALWAYS apply rate limits to auth endpoints, expensive operations, and public APIs (prevents brute force and DoS)
</rules>

Escape output to prevent XSS. Set secure cookie flags. Use security headers (CSP, X-Frame-Options). Verify resource ownership before operations. Audit sensitive operations. Keep dependencies updated and check for known vulnerabilities.

Project-specific auth, rate limiting, CORS, and security middleware patterns: [docs/SECURITY.md](../../docs/SECURITY.md).

**Enforcement:** Required — security rules must be followed.
