import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "@/api/auth";
import Card from "@/components/ui/Card";
import PasswordInput from "@/components/ui/PasswordInput";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = (params.get("token") || "").trim();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage("Reset token is missing.");
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    try {
      await resetPassword({ token, new_password: password });
      setMessage("Password updated. Redirecting to login...");
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page-bg)" }}>
      <Card className="w-full max-w-md" padding="lg">
        <h1 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)" }}>
          Reset Password
        </h1>
        <form className="space-y-4 mt-6" onSubmit={onSubmit}>
          <PasswordInput
            value={password}
            onChange={setPassword}
            label="New Password"
            autoComplete="new-password"
            showStrength
            showRules
            required
          />
          {message && <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{message}</p>}
          <button className="duo-btn duo-btn-blue w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update password"}
          </button>
          <Link to="/login" style={{ color: "var(--blue)", fontWeight: 700 }}>
            Back to login
          </Link>
        </form>
      </Card>
    </div>
  );
}
