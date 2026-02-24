import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown } from "lucide-react";
import { createCheckout, createPortal, getBillingStatus } from "@/api/billing";
import { PRO_DAILY_PRICE, PRO_MONTHLY_PRICE } from "@/constants/pricing";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";

const featureRows = [
  { name: "AI tutor sessions", free: "5/day", pro: "Unlimited sessions" },
  { name: "Document uploads", free: "10 total", pro: "Unlimited uploads" },
  { name: "Exam simulations", free: "3/day", pro: "Unlimited practice exams" },
  { name: "Flashcard generation", free: "20/day", pro: "Unlimited flashcards" },
  { name: "AutoTeach sessions", free: "3/day", pro: "Unlimited AutoTeach" },
  { name: "Priority AI responses", free: "---", pro: "Faster response times" },
];

const usageLabels: Record<string, string> = {
  tutor_sessions_daily: "Tutor sessions",
  document_uploads_total: "Document uploads",
  exam_generations_daily: "Exam simulations",
  flashcard_generations_daily: "Flashcard generations",
  auto_teach_sessions_daily: "AutoTeach sessions",
};

export default function PricingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isPro } = useAuth();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const checkoutStatus = searchParams.get("checkout");

  const { data: billing } = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus,
    enabled: isAuthenticated,
  });
  const usageKeys = Object.keys(billing?.limits ?? {});

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      navigate("/login?next=%2Fpricing");
      return;
    }
    setError("");
    setIsBusy(true);
    try {
      const data = await createCheckout();
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setIsBusy(false);
    }
  };

  const handleManage = async () => {
    setError("");
    setIsBusy(true);
    try {
      const data = await createPortal();
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "var(--page-bg)" }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 style={{ fontSize: "36px", fontWeight: 900, color: "var(--text-primary)" }}>
            Choose Your Plan
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "16px" }}>
            Start free, upgrade when you need deeper practice and unlimited access.
          </p>
        </div>

        {checkoutStatus === "success" && (
          <Card padding="md" style={{ background: "var(--green-bg)", borderColor: "var(--green)" }}>
            <p style={{ color: "var(--green)", fontWeight: 700 }}>
              Payment successful. You now have Pro access.
            </p>
          </Card>
        )}
        {checkoutStatus === "cancel" && (
          <Card padding="md" style={{ background: "var(--orange-bg)", borderColor: "var(--orange)" }}>
            <p style={{ color: "var(--orange)", fontWeight: 700 }}>
              Checkout was cancelled. You can upgrade anytime.
            </p>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4 items-stretch">
          <Card padding="lg" style={{ borderColor: "var(--border)", background: "var(--surface-bg)" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)" }}>Free</h2>
            <p style={{ color: "var(--text-muted)", fontWeight: 700, marginBottom: "14px" }}>Great for getting started</p>
            <ul className="space-y-2">
              {featureRows.map((row) => (
                <li key={row.name} className="flex items-center gap-2">
                  <Check size={16} style={{ color: "var(--green)" }} />
                  <span style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: "14px" }}>
                    {row.name}: {row.free}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            padding="lg"
            className="relative"
            style={{
              borderColor: "var(--gold)",
              boxShadow: "0 0 0 1px var(--gold), 0 18px 40px rgba(255, 202, 40, 0.16)",
            }}
          >
            <div className="absolute -top-3 right-4 px-2 py-0.5 rounded text-xs font-bold" style={{ background: "var(--gold-bg)", color: "var(--gold)" }}>Recommended</div>
            <div className="flex items-center gap-2">
              <Crown size={20} style={{ color: "var(--gold)" }} />
              <h2 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)" }}>Pro</h2>
            </div>
            <p style={{ fontSize: "32px", fontWeight: 900, color: "var(--text-primary)", marginTop: 6 }}>
              {PRO_MONTHLY_PRICE}
            </p>
            <p style={{ color: "var(--text-muted)", fontWeight: 700, marginTop: 2, marginBottom: 6 }}>
              That's about {PRO_DAILY_PRICE}/day
            </p>
            <p style={{ color: "var(--text-muted)", fontWeight: 700, marginBottom: "14px" }}>
              Unlimited practice and faster progress
            </p>
            <ul className="space-y-2">
              {featureRows.map((row) => (
                <li key={row.name} className="flex items-center gap-2">
                  <Check size={16} style={{ color: "var(--green)" }} />
                  <span style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: "14px" }}>
                    {row.name}: {row.pro}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {billing?.tier === "free" && usageKeys.length > 0 && (
          <Card padding="md" style={{ borderColor: "var(--blue)", background: "var(--surface-bg)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>
              Your Free plan usage
            </h3>
            <div className="space-y-3">
              {usageKeys.map((key) => {
                const limit = billing.limits[key] ?? 0;
                const used = billing.usage[key] ?? 0;
                const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)" }}>
                        {usageLabels[key] ?? key}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {used}/{limit}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? "var(--red)" : "var(--green)",
                          transition: "width 200ms ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {billing && (
          <Card padding="md">
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>
              Current tier: <span style={{ color: "var(--text-primary)" }}>{billing.tier.toUpperCase()}</span>
              {" "}({billing.subscription_status})
            </p>
          </Card>
        )}

        {error && (
          <Card padding="md" style={{ background: "var(--red-bg)", borderColor: "var(--red)" }}>
            <p style={{ color: "var(--red)", fontWeight: 700 }}>{error}</p>
          </Card>
        )}

        <div className="flex gap-3 justify-center">
          {!isPro ? (
            <button className="duo-btn duo-btn-green" onClick={handleUpgrade} disabled={isBusy}>
              {isBusy ? "Working..." : "Upgrade to Pro"}
            </button>
          ) : (
            <button className="duo-btn duo-btn-outline" onClick={handleManage} disabled={isBusy}>
              {isBusy ? "Opening..." : "Manage Subscription"}
            </button>
          )}
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="duo-btn duo-btn-outline">
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
