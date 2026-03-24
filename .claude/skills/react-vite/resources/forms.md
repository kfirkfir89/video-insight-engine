# Form Patterns

React Hook Form + Zod validation, field arrays, multi-step forms, and React 19 form actions.

<rules>
- ALWAYS use React Hook Form + zodResolver for forms — never manual useState per field (causes validation drift, missing error states, re-render storms)
- ALWAYS define Zod schemas as the single source of truth — infer TypeScript types with `z.infer<typeof schema>` (causes type/validation mismatch if separate)
- ALWAYS use `setError('root', ...)` for form-level API errors and `setError('fieldName', ...)` for field-level server errors (causes lost error context if swallowed)
- ALWAYS use `Controller` for custom components that don't support `{...register()}` (causes uncontrolled form behavior)
- ALWAYS disable submit button when `isSubmitting || !isDirty` (causes double submissions and no-op saves)
- NEVER use `onChange` mode unless you need live validation feedback — default `onSubmit` is more performant (causes excessive re-renders on every keystroke)
- NEVER build multi-field forms with raw useState — even simple 2-field forms benefit from RHF's error handling (causes error state management bugs)
</rules>

---

## Basic Form

ALWAYS define schema first, infer types, wire to RHF with zodResolver.

```tsx
const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm({ onSubmit }: { onSubmit: (data: LoginFormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && (
        <p className="text-red-500 text-sm">{errors.email.message}</p>
      )}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

---

## Server Error Handling

ALWAYS map API errors to field-level or form-level errors.

```tsx
const onSubmit = async (data: FormData) => {
  try {
    await api.submit(data);
  } catch (error) {
    if (error.code === "EMAIL_EXISTS") {
      setError("email", { message: "Already registered" });
    } else {
      setError("root", { message: "Something went wrong" });
    }
  }
};
```

---

## Reusable Form Components

ALWAYS wire `aria-invalid` and `aria-describedby` for accessibility.

```tsx
function FormInput({ label, error, id, ...props }: FormInputProps) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
```

---

## Field Arrays

Use `useFieldArray` for dynamic lists. Key by `field.id`, not array index.

```tsx
const { fields, append, remove } = useFieldArray({ control, name: "todos" });
// Render: fields.map((field, index) => <div key={field.id}>...)
```

---

## Multi-Step Forms

Use `FormProvider` + `useFormContext` for step components. Validate per-step with `trigger()`.

```tsx
const nextStep = async () => {
  const isValid = await methods.trigger(["email", "name"]);
  if (isValid) setStep(step + 1);
};
```

---

## React 19 Form Actions

**useActionState** pairs with RHF for server-action forms. **useFormStatus** gives submit buttons access to pending state (must be a child component inside `<form>`).

```tsx
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Submitting..." : children}
    </button>
  );
}
```

---

## Edge Cases

- **Conditional fields:** Use `watch('fieldName')` to show/hide fields. Conditionally rendered fields still validate — use `shouldUnregister: true` or adjust schema with `.optional()` when hidden.
- **File uploads:** Use `Controller` with a file input. Zod can validate with `z.instanceof(File)` or custom refinement.
- **Cross-field validation:** Use `.refine()` or `.superRefine()` on the object schema. Map errors to specific fields via `path: ['fieldName']`.

---

## Rules Summary

Every form uses React Hook Form with Zod schemas as the single source of truth. Types are inferred from schemas, not duplicated. Server errors map to field-level or root-level via setError. Custom inputs use Controller, dynamic lists use useFieldArray, and multi-step forms use FormProvider with per-step trigger validation. Submit buttons are disabled during submission. React 19 useActionState and useFormStatus integrate with RHF for server actions.
