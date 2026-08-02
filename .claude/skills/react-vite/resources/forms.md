# Form Patterns

Zod schemas over controlled state. **react-hook-form is NOT installed in this
repo** — do not import it. The canonical implementations are
`apps/web/src/pages/LoginPage.tsx` / `RegisterPage.tsx` with shared helpers in
`apps/web/src/lib/validation.ts`.

<rules>
- ALWAYS define a Zod schema as the single source of truth and infer the value type with `z.infer<typeof schema>` (causes type/validation mismatch if separate)
- ALWAYS derive field errors during render — `useMemo(() => schema.safeParse(values), [values])` + `fieldErrorsFrom()` — never store errors in their own useState (causes stale-error sync bugs)
- ALWAYS gate error display on a `touched` map (mark on blur; mark ALL touched on submit) — showing errors on pristine fields punishes the user for not having typed yet
- ALWAYS wire `aria-invalid` and `aria-describedby` on invalid fields (screen readers announce nothing otherwise)
- ALWAYS disable submit while loading and translate API failures to user-friendly copy (e.g. `translateAuthError`) — never show raw error codes
- NEVER import react-hook-form — it is not a dependency (causes build failure)
- NEVER validate with hand-written per-field `if` chains — the Zod schema is the validator (causes validation drift)
</rules>

---

## Canonical Form (the LoginPage pattern)

```tsx
import { loginSchema, fieldErrorsFrom, translateAuthError,
  type LoginValues, type FieldErrors } from "@/lib/validation";

export function LoginPage() {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof LoginValues, boolean>>>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  // Errors are DERIVED, never stored
  const errors: FieldErrors<LoginValues> = useMemo(() => {
    const result = loginSchema.safeParse(values);
    return result.success ? {} : fieldErrorsFrom(result.error);
  }, [values]);

  const handleBlur = (field: keyof LoginValues) => () =>
    setTouched((t) => ({ ...t, [field]: true }));
  const handleChange = (field: keyof LoginValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setTouched({ email: true, password: true });   // surface all errors
    if (Object.keys(errors).length > 0) return;
    setSubmitError("");
    setLoading(true);
    try {
      await login(values.email, values.password);
      navigate("/board");
    } catch (err) {
      setSubmitError(translateAuthError(err, "login"));
    } finally {
      setLoading(false);
    }
  };
  // <form onSubmit={handleSubmit} noValidate> …
}
```

Key moves: one `values` object (not one useState per field), errors derived via
`useMemo` + `safeParse`, `touched` gates display, form-level API error in its
own state rendered as a destructive `<Alert>`.

---

## Field Rendering

Show a field's error only when touched; wire accessibility attributes:

```tsx
<Label htmlFor="email">Email</Label>
<Input
  id="email"
  type="email"
  value={values.email}
  onChange={handleChange("email")}
  onBlur={handleBlur("email")}
  aria-invalid={touched.email && !!errors.email}
  aria-describedby={touched.email && errors.email ? "email-error" : undefined}
/>
{touched.email && errors.email && (
  <p id="email-error" className="text-sm text-destructive">{errors.email}</p>
)}
```

---

## Cross-Field Validation

Use `.refine()` / `.superRefine()` on the schema and map the error to a field
via `path` — `fieldErrorsFrom` picks it up like any other field error:

```tsx
const registerSchema = z
  .object({ password: z.string().min(8), confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
```

---

## Simple One-Field Forms

For single-input flows (e.g. `VideoIntakeForm`'s URL box), a lone `useState`
plus explicit validation on submit is fine — don't force ceremony where the
schema would be one field. Still keep the error user-friendly and derived.

---

## Edge Cases

- **Conditional fields:** keep them in the schema as `.optional()` and refine
  when visible; hidden fields must not block submission.
- **Server field errors:** map API error codes to the matching field in the
  submit `catch`, falling back to a form-level `submitError`.
- **RTL:** forms render under `DirectionContext` — use logical CSS properties
  (`ms-*`/`me-*`, `text-start`) so labels/errors mirror correctly.

---

## Rules Summary

Forms are controlled `useState` objects validated by Zod schemas — errors are
derived with `useMemo` + `safeParse` + `fieldErrorsFrom`, displayed only for
touched fields, and submit marks everything touched before bailing. API
failures translate to friendly copy at form level or map to specific fields.
Accessibility attributes (`aria-invalid`, `aria-describedby`) are mandatory.
react-hook-form is not installed; do not add it without a team decision.
