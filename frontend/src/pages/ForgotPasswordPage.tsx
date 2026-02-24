import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "@/api/auth";
import Card from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      const data = await forgotPassword({ email: email.trim() });
      setMessage(data.message || "If an account exists, a reset link has been sent");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page-bg)" }}>
      <Card className="w-full max-w-md" padding="lg">
        <h1 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)" }}>
          Forgot Password
        </h1>
        <p className="mt-2" style={{ color: "var(--text-muted)" }}>
          Enter your email and we will send a reset link if the account exists.
        </p>
        <form className="space-y-4 mt-6" onSubmit={onSubmit}>
          <div>
            <label className="duo-label" htmlFor="forgot_email">Email</label>
            <input
              id="forgot_email"
              className="duo-input w-full"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          {message && <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{message}</p>}
          <button className="duo-btn duo-btn-blue w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
          <Link to="/login" style={{ color: "var(--blue)", fontWeight: 700 }}>
            Back to login
          </Link>
        </form>
      </Card>
    </div>
  );
}
