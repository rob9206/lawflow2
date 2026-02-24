import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import PasswordInput from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      const next = searchParams.get("next");
      navigate(next || "/dashboard", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page-bg)" }}>
      <Card className="w-full max-w-md" padding="lg">
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
            Welcome back to
          </h2>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "var(--text-primary)", marginBottom: "8px" }}>
            LawFlow
          </h1>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
            Your AI-powered law study companion
          </p>
        </div>
        
        <div className="flex items-center gap-2 mb-6">
          <LogIn size={20} style={{ color: "var(--blue)" }} />
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>Log In</h2>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="duo-label" htmlFor="login_email">Email</label>
            <input
              id="login_email"
              className="duo-input w-full"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              label="Password"
              autoComplete="current-password"
              required
            />
          </div>
          <div style={{ textAlign: "right", marginTop: "-8px" }}>
            <Link
              to="/forgot-password"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--blue)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              Forgot password?
            </Link>
          </div>
          {error && (
            <div className="duo-card p-3" style={{ background: "var(--red-bg)", borderColor: "var(--red)" }}>
              <p style={{ color: "var(--red)", fontWeight: 700, fontSize: "14px" }}>{error}</p>
            </div>
          )}
          <button type="submit" className="duo-btn duo-btn-blue w-full" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>
        </form>
        <p className="mt-4" style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 600 }}>
          No account yet?{" "}
          <Link to="/register" style={{ color: "var(--blue)", fontWeight: 800 }}>
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
