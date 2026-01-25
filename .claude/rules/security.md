# Security Rules

## Secrets

- NEVER hardcode secrets, API keys, or passwords
- Use environment variables for all sensitive data
- Check for exposed secrets before committing
- Don't log sensitive information

## Input Validation

- Validate ALL user input
- Sanitize before database queries
- Escape output to prevent XSS
- Use parameterized queries (no string concatenation)

## Authentication

- Verify auth on every protected route
- Use secure session handling
- Implement proper RBAC
- Never expose user IDs in URLs where avoidable

## Authorization

- Check permissions at the data layer, not just routes
- Verify resource ownership before operations
- Use principle of least privilege
- Audit sensitive operations

## Dependencies

- Keep dependencies updated
- Check for known vulnerabilities
- Audit before adding new packages
- Prefer well-maintained packages

## Error Handling

- Don't expose stack traces to users
- Don't reveal internal paths or structure
- Log security events
- Return generic error messages externally

## CORS & Headers

- Configure CORS properly (not `*` in production)
- Use security headers (CSP, X-Frame-Options, etc.)
- Set secure cookie flags

## Rate Limiting

- Apply rate limits to auth endpoints
- Apply rate limits to expensive operations
- Apply rate limits to public APIs

## Project-Specific

Refer to [docs/SECURITY.md](../../docs/SECURITY.md) for:
- Auth patterns specific to this project
- Rate limiting configuration
- CORS setup
- Security middleware

## Enforcement Level

**Required** - Security rules must be followed.
