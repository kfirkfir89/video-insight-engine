# Security Patterns (React)

XSS prevention, token storage, CSRF, and frontend security best practices.

---

## XSS Prevention

### DO ✅

```tsx
// React auto-escapes by default
function UserProfile({ user }: { user: User }) {
  // ✅ Safe - React escapes this
  return <div>{user.name}</div>;
}

// Sanitize HTML when you MUST render it
import DOMPurify from 'dompurify';

function RichContent({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'li'],
    ALLOWED_ATTR: [],
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// Sanitize URLs
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!isValidUrl(href)) {
    return <span>{children}</span>;
  }
  return (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}
```

### DON'T ❌

```tsx
// ❌ NEVER use dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ❌ Don't construct HTML strings
const html = `<div>${userInput}</div>`;

// ❌ Don't use javascript: URLs
<a href={`javascript:${userInput}`}>Click</a>
```

---

## Secure Token Storage

### DO ✅

```tsx
// Option 1: Memory only (most secure, lost on refresh)
let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Option 2: HttpOnly cookies (server must set)
// Token never accessible to JavaScript - most secure for auth

// Option 3: sessionStorage (cleared on tab close)
function useSessionToken() {
  const [token, setTokenState] = useState<string | null>(() => {
    return sessionStorage.getItem('token');
  });

  const setToken = (newToken: string | null) => {
    if (newToken) {
      sessionStorage.setItem('token', newToken);
    } else {
      sessionStorage.removeItem('token');
    }
    setTokenState(newToken);
  };

  return [token, setToken] as const;
}
```

### DON'T ❌

```tsx
// ❌ localStorage for sensitive tokens (XSS can steal)
localStorage.setItem('accessToken', token);

// ❌ Storing refresh tokens in frontend
localStorage.setItem('refreshToken', refreshToken);

// ❌ Token in URL
window.location.href = `/dashboard?token=${token}`;
```

---

## API Request Security

### DO ✅

```tsx
// Secure fetch wrapper
async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: 'same-origin', // or 'include' for cross-origin with cookies
  });

  // Handle token expiry
  if (response.status === 401) {
    // Redirect to login or refresh token
    await handleUnauthorized();
  }

  return response;
}

// React Query with auth
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof Error && error.message.includes('401')) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});
```

---

## Input Validation

### DO ✅

```tsx
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Validate on client AND server
const userSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string()
    .min(2, 'Too short')
    .max(100, 'Too long')
    .regex(/^[a-zA-Z\s]+$/, 'Only letters allowed'),
  website: z.string().url().optional().or(z.literal('')),
});

function UserForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(userSchema),
  });

  const onSubmit = async (data: z.infer<typeof userSchema>) => {
    // Data is validated, safe to send
    await api.createUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} type="email" />
      {errors.email && <span>{errors.email.message}</span>}
      {/* ... */}
    </form>
  );
}
```

---

## CSRF Protection

### DO ✅

```tsx
// Use SameSite cookies (server-side)
// Set-Cookie: token=xxx; SameSite=Strict; Secure; HttpOnly

// For APIs without cookies, use custom headers
async function csrfProtectedFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Requested-With': 'XMLHttpRequest', // Custom header
    },
  });
}

// Double-submit cookie pattern
function useCSRFToken() {
  const [csrfToken, setCSRFToken] = useState<string>('');

  useEffect(() => {
    // Get CSRF token from cookie or meta tag
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (token) setCSRFToken(token);
  }, []);

  return csrfToken;
}
```

---

## Environment Variables

### DO ✅

```tsx
// .env (NEVER commit!)
VITE_API_URL=https://api.example.com
VITE_PUBLIC_KEY=pk_live_xxx

// Access in code
const apiUrl = import.meta.env.VITE_API_URL;

// Validate at startup
if (!import.meta.env.VITE_API_URL) {
  throw new Error('VITE_API_URL is required');
}
```

### DON'T ❌

```tsx
// ❌ Secret keys in frontend
VITE_SECRET_KEY=sk_live_xxx  // NEVER!
VITE_DATABASE_URL=postgres://...  // NEVER!

// ❌ Hardcoded secrets
const apiKey = 'sk-xxx';
```

---

## Content Security Policy

### DO ✅

```html
<!-- In index.html or via server headers -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
">
```

```tsx
// Nonce for inline scripts (server-generated)
function App() {
  return (
    <script nonce={window.__CSP_NONCE__}>
      {/* Safe inline script */}
    </script>
  );
}
```

---

## Secure External Links

### DO ✅

```tsx
// Always use rel="noopener noreferrer" for external links
function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

// Warn users before leaving
function ConfirmExternalLink({ href, children }: ExternalLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    const isExternal = !href.startsWith(window.location.origin);
    
    if (isExternal && !confirm('You are leaving this site. Continue?')) {
      e.preventDefault();
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
```

---

## Sensitive Data Handling

### DO ✅

```tsx
// Mask sensitive data in UI
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskCardNumber(number: string): string {
  return `****-****-****-${number.slice(-4)}`;
}

// Clear sensitive data from memory
function SecureInput({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    onSubmit(value);
    setValue(''); // Clear after submit
  };

  return (
    <input
      type="password"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      autoComplete="off"
    />
  );
}

// Don't log sensitive data
console.log('User:', { ...user, password: '[REDACTED]' });
```

---

## Dependency Security

### DO ✅

```bash
# Regular audits
npm audit
npm audit fix

# Check for known vulnerabilities
npx snyk test

# Lock file integrity
npm ci  # Use in CI, respects lock file
```

```json
// package.json - Use exact versions for security-critical deps
{
  "dependencies": {
    "dompurify": "3.0.6"
  }
}
```

---

## Quick Reference

| Attack | Prevention |
|--------|------------|
| XSS | React escaping, DOMPurify, CSP |
| CSRF | SameSite cookies, custom headers |
| Token theft | HttpOnly cookies, memory storage |
| Clickjacking | X-Frame-Options, CSP frame-ancestors |
| Open redirect | Validate URLs, whitelist domains |

| Storage | Security Level | Use For |
|---------|----------------|---------|
| Memory | Highest | Access tokens |
| HttpOnly cookie | High | Auth tokens |
| sessionStorage | Medium | Non-sensitive session data |
| localStorage | Low | Preferences only |

| Rule | Implementation |
|------|----------------|
| Never trust user input | Validate + sanitize |
| Least privilege | Minimal permissions |
| Defense in depth | Multiple layers |
| Secure defaults | Opt-in to risky features |
