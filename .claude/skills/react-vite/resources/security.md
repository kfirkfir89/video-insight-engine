# Security Patterns (React)

XSS prevention, token storage, CSRF, input validation, and frontend security.

<rules>
- ALWAYS sanitize HTML with DOMPurify before using dangerouslySetInnerHTML — with explicit ALLOWED_TAGS whitelist (causes XSS if unsanitized user input rendered as HTML)
- ALWAYS validate URLs against http/https protocol before rendering in href — reject javascript: and data: schemes (causes XSS via protocol injection)
- ALWAYS store auth tokens in memory or HttpOnly cookies — never localStorage (causes token theft via XSS — localStorage is fully accessible to scripts)
- ALWAYS use Zod schemas for client-side input validation — validate on BOTH client and server (causes injection if only one side validates)
- ALWAYS add `rel="noopener noreferrer"` to external links with `target="_blank"` (causes reverse tabnapping vulnerability)
- NEVER put secrets in VITE_ environment variables — they are embedded in the client bundle (causes credential exposure in browser source)
- NEVER use dangerouslySetInnerHTML without DOMPurify (causes stored/reflected XSS)
</rules>

---

## XSS Prevention

React auto-escapes JSX expressions. The risk is `dangerouslySetInnerHTML` and user-controlled URLs.

```tsx
import DOMPurify from "dompurify";

function RichContent({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "li"],
    ALLOWED_ATTR: [],
  });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

ALWAYS validate URLs:

```tsx
function isValidUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
```

---

## Token Storage

| Storage         | Security | Use For                                |
| --------------- | -------- | -------------------------------------- |
| Memory variable | Highest  | Access tokens (lost on refresh)        |
| HttpOnly cookie | High     | Auth tokens (server-set, no JS access) |
| sessionStorage  | Medium   | Non-sensitive session data             |
| localStorage    | Low      | Preferences only — NEVER tokens        |

---

## API Request Security

ALWAYS handle 401 globally (redirect to login or refresh token). ALWAYS use `credentials: 'same-origin'` or `'include'` for cookie-based auth. Don't retry on 401.

---

## Input Validation

ALWAYS validate with Zod on the client AND expect server validation too.

```tsx
const userSchema = z.object({
  email: z.string().email(),
  name: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z\s]+$/),
});
```

---

## Environment Variables

ONLY use `VITE_` prefix for public, non-sensitive values (API base URL, public keys). NEVER for secret keys, database URLs, or private API keys.

```tsx
// Validate at startup
if (!import.meta.env.VITE_API_URL) throw new Error("VITE_API_URL required");
```

---

## CSP and External Links

ALWAYS set Content-Security-Policy headers. ALWAYS use `rel="noopener noreferrer"` on external links.

---

## Edge Cases

- **Refresh tokens:** Never store in the frontend. Use HttpOnly cookie rotation on the server. The frontend only holds the short-lived access token in memory.
- **CSRF with SPAs:** If using cookie-based auth, add a custom header (X-Requested-With) that CORS preflight will verify. SameSite=Strict cookies also prevent CSRF.
- **Sensitive data in UI:** Mask emails/card numbers in display. Clear password fields after submission. Never log sensitive data to console.

---

## Rules Summary

React's JSX escaping prevents most XSS, but dangerouslySetInnerHTML requires DOMPurify with an explicit allowlist. URLs must validate against http/https protocols. Auth tokens live in memory or HttpOnly cookies, never localStorage. All inputs validate with Zod on both client and server. VITE\_ env vars are public — secrets stay server-side. External links always get noopener noreferrer, and CSP headers restrict script sources. The frontend assumes all user input is hostile.
