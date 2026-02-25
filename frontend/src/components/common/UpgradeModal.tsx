import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useUpgrade } from "@/context/UpgradeContext";
import { useAuth } from "@/context/AuthContext";
import { getBillingStatus } from "@/api/billing";
import { PRO_MONTHLY_PRICE, PRO_DAILY_PRICE } from "@/constants/pricing";
import {
  Crown,
  X,
  Check,
  Zap,
  Sparkles,
  GraduationCap,
  FileText,
  Brain,
  ClipboardList,
  CreditCard,
  ArrowRight,
} from "lucide-react";

const USAGE_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
  tutor_sessions_daily: { label: "Tutor sessions", icon: GraduationCap },
  document_uploads_total: { label: "Document uploads", icon: FileText },
  exam_generations_daily: { label: "Exam simulations", icon: ClipboardList },
  flashcard_generations_daily: { label: "Flashcard generations", icon: CreditCard },
  auto_teach_sessions_daily: { label: "AutoTeach sessions", icon: Brain },
};

const PRO_FEATURES = [
  "Unlimited tutor sessions",
  "Unlimited document uploads",
  "Unlimited exam simulations",
  "Unlimited flashcard generation",
  "Unlimited AutoTeach sessions",
  "Priority AI responses",
];

export default function UpgradeModal() {
  const { isOpen, featureMessage, hideUpgrade } = useUpgrade();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const { data: billing } = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus,
    enabled: isAuthenticated && isOpen,
  });

  if (!isOpen) return null;

  const handleUpgrade = () => {
    hideUpgrade();
    navigate("/pricing");
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) hideUpgrade();
  };

  const usageKeys = Object.keys(billing?.limits ?? {});
  const hasUsage = billing && billing.tier === "free" && usageKeys.length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="duo-card relative w-full animate-scale-in overflow-hidden"
        style={{ maxWidth: 480, margin: "0 16px" }}
      >
        {/* Gold top accent */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: 4, background: "linear-gradient(90deg, var(--gold), var(--orange))" }}
        />

        {/* Close button */}
        <button
          onClick={hideUpgrade}
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={20} />
        </button>

        <div className="p-6 pt-8">
          {/* Header */}
          <div className="text-center mb-5">
            <div
              className="mx-auto mb-3 flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, background: "var(--gold-bg)" }}
            >
              <Crown size={32} style={{ color: "var(--gold)" }} />
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>
              You've hit your free limit
            </h2>
            {featureMessage && (
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {featureMessage}
              </p>
            )}
          </div>

          {/* Usage bars */}
          {hasUsage && (
            <div
              className="rounded-xl mb-5"
              style={{ padding: "14px 16px", background: "var(--surface-bg)" }}
            >
              <p style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10 }}>
                Today's usage
              </p>
              <div className="space-y-2.5">
                {usageKeys.map((key) => {
                  const limit = billing.limits[key] ?? 0;
                  const used = billing.usage[key] ?? 0;
                  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                  const atLimit = pct >= 100;
                  const meta = USAGE_LABELS[key];
                  const Icon = meta?.icon || Zap;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5" style={{ fontSize: "13px", fontWeight: 700, color: atLimit ? "var(--red)" : "var(--text-secondary)" }}>
                          <Icon size={13} />
                          {meta?.label ?? key}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: atLimit ? "var(--red)" : "var(--text-primary)" }}>
                          {used}/{limit}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: atLimit ? "var(--red)" : pct >= 80 ? "var(--orange)" : "var(--green)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pro features */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} style={{ color: "var(--gold)" }} />
              <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-primary)" }}>
                Upgrade to Pro — {PRO_MONTHLY_PRICE}/mo
              </p>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                ({PRO_DAILY_PRICE}/day)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-1.5">
                  <Check size={12} style={{ color: "var(--green)" }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                    {f}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleUpgrade}
              className="duo-btn duo-btn-green flex-1 flex items-center justify-center gap-2"
            >
              <Crown size={16} />
              Upgrade to Pro
              <ArrowRight size={16} />
            </button>
            <button
              onClick={hideUpgrade}
              className="duo-btn duo-btn-outline"
              style={{ padding: "12px 20px" }}
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
