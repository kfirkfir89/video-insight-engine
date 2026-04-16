import { useState, useMemo, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import {
  loginSchema,
  fieldErrorsFrom,
  translateAuthError,
  type LoginValues,
  type FieldErrors,
} from "@/lib/validation";

type LoginErrors = FieldErrors<LoginValues>;

export function LoginPage() {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof LoginValues, boolean>>>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const errors: LoginErrors = useMemo(() => {
    const result = loginSchema.safeParse(values);
    return result.success ? {} : fieldErrorsFrom(result.error);
  }, [values]);

  const handleBlur = (field: keyof LoginValues) => () =>
    setTouched((t) => ({ ...t, [field]: true }));
  const handleChange = (field: keyof LoginValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
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

  return (
    <div className="surface-ambient flex min-h-screen items-center justify-center page-gutter page-gutter-y">
      <Card className="w-full max-w-md shadow-lg accent-rule overflow-hidden">
        <CardHeader>
          <CardTitle className="type-page-title text-center text-balance">Welcome back</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={handleChange("email")}
                onBlur={handleBlur("email")}
                placeholder="you@example.com"
                aria-invalid={touched.email && !!errors.email}
                aria-describedby={touched.email && errors.email ? "email-error" : undefined}
                autoComplete="email"
                required
              />
              {touched.email && errors.email && (
                <p id="email-error" className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={values.password}
                onChange={handleChange("password")}
                onBlur={handleBlur("password")}
                placeholder="Enter your password"
                aria-invalid={touched.password && !!errors.password}
                aria-describedby={touched.password && errors.password ? "password-error" : undefined}
                autoComplete="current-password"
                required
              />
              {touched.password && errors.password && (
                <p id="password-error" className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_LOGIN === "true") && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  try {
                    await login("admin@admin.com", "Admin123");
                    navigate("/board");
                  } catch (err) {
                    setSubmitError(translateAuthError(err, "login"));
                  }
                }}
              >
                Sign in as admin (dev only)
              </Button>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
