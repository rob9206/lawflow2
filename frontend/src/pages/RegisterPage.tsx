import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import PasswordInput from "@/components/ui/PasswordInput";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const passwordsMatch = password === confirmPassword;
  const passwordValid = useMemo(() => {
    const pwd = password;
    return (
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /\d/.test(pwd) &&
      /[!@#$%^&*\-_=+\[\]{}|;:,.<>?]/.test(pwd)
    );
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Client-side validation
    if (!passwordValid) {
      setError("Password does not meet all requirements");
      return;
    }
    
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim() || undefined);
      const next = searchParams.get("next");
      navigate(next || "/dashboard", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
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
            Welcome to
          </h2>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "var(--text-primary)", marginBottom: "8px" }}>
            LawFlow
          </h1>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
            Your AI-powered law study companion
          </p>
        </div>
        
        <div className="flex items-center gap-2 mb-6">
          <UserPlus size={20} style={{ color: "var(--green)" }} />
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>Create Account</h2>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="duo-label">Display Name</label>
            <input
              className="duo-input w-full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Law Student"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="duo-label">Email</label>
            <input
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
              showStrength
              showRules
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              label="Confirm Password"
              autoComplete="new-password"
              required
            />
            {confirmPassword && !passwordsMatch && (
              <p style={{ color: "var(--red)", fontWeight: 600, fontSize: "12px", marginTop: "6px" }}>
                Passwords do not match
              </p>
            )}
          </div>
          {error && (
            <div className="duo-card p-3" style={{ background: "var(--red-bg)", borderColor: "var(--red)" }}>
              <p style={{ color: "var(--red)", fontWeight: 700, fontSize: "14px" }}>{error}</p>
            </div>
          )}
          <button
            type="submit"
            className="duo-btn duo-btn-green w-full"
            disabled={isSubmitting || !passwordValid || !passwordsMatch}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="mt-4" style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 600 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--blue)", fontWeight: 800 }}>
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
