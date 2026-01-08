# Form Patterns

React Hook Form, validation, and form handling best practices.

---

## React Hook Form

### DO ✅

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define schema
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && (
          <p className="text-red-500 text-sm">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className={errors.password ? 'border-red-500' : ''}
        />
        {errors.password && (
          <p className="text-red-500 text-sm">{errors.password.message}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
```

### DON'T ❌

```tsx
// Manual state management
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    // Manual validation...
    if (!email.includes('@')) {
      setErrors({ email: 'Invalid email' });
    }
    // More validation...
  };

  return (/* ... */);
}
```

---

## Controlled Components with RHF

### DO ✅

```tsx
import { Controller } from 'react-hook-form';

function ProfileForm() {
  const { control, handleSubmit } = useForm<ProfileData>();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* For custom components that don't support {...register} */}
      <Controller
        name="country"
        control={control}
        render={({ field }) => (
          <Select
            value={field.value}
            onChange={field.onChange}
            options={countries}
          />
        )}
      />

      <Controller
        name="birthDate"
        control={control}
        render={({ field }) => (
          <DatePicker
            selected={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </form>
  );
}
```

---

## Validation Schemas

### DO ✅

```tsx
import { z } from 'zod';

// Reusable field schemas
const emailSchema = z.string().email('Invalid email');
const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase letter')
  .regex(/[0-9]/, 'At least one number');

// Compose into form schemas
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

// Complex validation
const productSchema = z.object({
  name: z.string().min(1, 'Required').max(100),
  price: z.coerce.number().positive('Must be positive'),
  category: z.enum(['electronics', 'clothing', 'food']),
  tags: z.array(z.string()).min(1, 'At least one tag'),
  metadata: z.record(z.string()).optional(),
});
```

---

## Form State

### DO ✅

```tsx
function ComplexForm() {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: {
      errors,
      isSubmitting,
      isDirty,
      isValid,
      dirtyFields,
    },
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      plan: 'free',
    },
    mode: 'onChange', // Validate on change
  });

  // Watch specific field
  const selectedPlan = watch('plan');

  // Conditional field
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <select {...register('plan')}>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>

      {selectedPlan === 'pro' && (
        <input {...register('cardNumber')} placeholder="Card number" />
      )}

      <button type="submit" disabled={isSubmitting || !isDirty || !isValid}>
        Submit
      </button>

      <button type="button" onClick={() => reset()}>
        Reset
      </button>
    </form>
  );
}
```

---

## Field Arrays

### DO ✅

```tsx
import { useFieldArray } from 'react-hook-form';

function TodoForm() {
  const { control, register, handleSubmit } = useForm<{
    todos: { text: string; completed: boolean }[];
  }>({
    defaultValues: {
      todos: [{ text: '', completed: false }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'todos',
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`todos.${index}.text`)} />
          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={() => append({ text: '', completed: false })}>
        Add Todo
      </button>

      <button type="submit">Save</button>
    </form>
  );
}
```

---

## Error Handling

### DO ✅

```tsx
function Form() {
  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await api.submit(data);
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS') {
        // Set field-level error
        setError('email', {
          type: 'manual',
          message: 'This email is already registered',
        });
      } else {
        // Set form-level error
        setError('root', {
          type: 'manual',
          message: 'Something went wrong. Please try again.',
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {errors.root && (
        <div className="bg-red-100 p-4 text-red-700">
          {errors.root.message}
        </div>
      )}
      {/* fields... */}
    </form>
  );
}
```

---

## Reusable Form Components

### DO ✅

```tsx
// Generic input component
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function FormInput({ label, error, id, ...props }: FormInputProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className={cn(
          'w-full rounded-md border px-3 py-2',
          error ? 'border-red-500' : 'border-gray-300'
        )}
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

// Usage with RHF
<FormInput
  id="email"
  label="Email"
  type="email"
  error={errors.email?.message}
  {...register('email')}
/>
```

---

## Multi-Step Forms

### DO ✅

```tsx
function MultiStepForm() {
  const [step, setStep] = useState(1);
  const methods = useForm<FormData>({
    mode: 'onChange',
  });

  const nextStep = async () => {
    const fieldsToValidate = step === 1 
      ? ['email', 'name'] 
      : ['address', 'city'];
    
    const isValid = await methods.trigger(fieldsToValidate);
    if (isValid) setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {step === 1 && <PersonalInfoStep />}
        {step === 2 && <AddressStep />}
        {step === 3 && <ReviewStep />}

        <div className="flex gap-4">
          {step > 1 && (
            <button type="button" onClick={prevStep}>Back</button>
          )}
          {step < 3 ? (
            <button type="button" onClick={nextStep}>Next</button>
          ) : (
            <button type="submit">Submit</button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}

// Step component uses useFormContext
function PersonalInfoStep() {
  const { register, formState: { errors } } = useFormContext<FormData>();

  return (
    <div>
      <input {...register('email')} />
      <input {...register('name')} />
    </div>
  );
}
```

---

## Quick Reference

| RHF Hook | Purpose |
|----------|---------|
| useForm | Main form hook |
| useFormContext | Access form in nested components |
| useFieldArray | Dynamic array fields |
| useWatch | Watch field values |
| useController | Controlled component wrapper |

| Form State | Description |
|------------|-------------|
| isDirty | Form has been modified |
| isValid | All validations pass |
| isSubmitting | Form is being submitted |
| errors | Validation errors |
| dirtyFields | Which fields changed |

| Validation | When |
|------------|------|
| mode: 'onSubmit' | Validate on submit (default) |
| mode: 'onChange' | Validate on every change |
| mode: 'onBlur' | Validate on blur |
| mode: 'all' | All of the above |
