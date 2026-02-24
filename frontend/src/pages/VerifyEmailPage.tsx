import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { verifyEmail } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    async function run() {
      const token = (params.get("token") || "").trim();
      if (!token) {
        setStatus("error");
        setMessage("Verification token is missing.");
        return;
      }
      try {
        await verifyEmail({ token });
        await refreshUser().catch(() => undefined);
        setStatus("success");
        setMessage("Your email is now verified.");
      } catch (err: unknown) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      }
    }
    void run();
  }, [params, refreshUser]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--page-bg)" }}
    >
      <Card className="w-full max-w-md" padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <MailCheck size={20} style={{ color: "var(--green)" }} />
          <h1 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)" }}>
            Email Verification
          </h1>
        </div>
        <p style={{ color: status === "error" ? "var(--red)" : "var(--text-primary)" }}>
          {message}
        </p>
        <div className="mt-6">
          <Link to="/login" className="duo-btn duo-btn-blue w-full text-center">
            Back to login
          </Link>
        </div>
      </Card>
    </div>
  );
}
