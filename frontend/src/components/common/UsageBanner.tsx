import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getBillingStatus } from "@/api/billing";
import { Crown, AlertTriangle } from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  tutor_sessions_daily: "tutor sessions",
  document_uploads_total: "document uploads",
  exam_generations_daily: "exam simulations",
  flashcard_generations_daily: "flashcard generations",
  auto_teach_sessions_daily: "AutoTeach sessions",
};

interface UsageBannerProps {
  feature: string;
}

export default function UsageBanner({ feature }: UsageBannerProps) {
  const { isAuthenticated, isPro } = useAuth();
  const navigate = useNavigate();

  const { data: billing } = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus,
    enabled: isAuthenticated && !isPro,
    staleTime: 30_000,
  });

  if (isPro || !billing || billing.tier !== "free") return null;

  const limit = billing.limits[feature] ?? 0;
  const used = billing.usage[feature] ?? 0;
  if (limit === 0) return null;

  const remaining = Math.max(0, limit - used);
  const pct = Math.round((used / limit) * 100);
  const label = FEATURE_LABELS[feature] ?? feature;

  if (pct < 60) return null;

  const atLimit = remaining === 0;
  const isWarning = !atLimit && pct >= 80;
  const isNotice = !atLimit && !isWarning;

  if (isNotice) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl mb-4 animate-slide-down"
      style={{
        padding: "10px 16px",
        background: atLimit ? "var(--red-bg)" : "var(--orange-bg)",
        border: `2px solid ${atLimit ? "var(--red)" : "var(--orange)"}`,
      }}
    >
      <AlertTriangle
        size={16}
        className="shrink-0"
        style={{ color: atLimit ? "var(--red)" : "var(--orange)" }}
      />
      <p className="flex-1" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
        {atLimit
          ? `You've used all ${limit} free ${label} today.`
          : `${remaining} of ${limit} free ${label} remaining today.`}
      </p>
      <button
        onClick={() => navigate("/pricing")}
        className="shrink-0 flex items-center gap-1.5 rounded-lg transition-colors"
        style={{
          padding: "5px 12px",
          fontSize: "12px",
          fontWeight: 800,
          background: atLimit ? "var(--red)" : "var(--orange)",
          color: "white",
          border: "none",
        }}
      >
        <Crown size={12} />
        Upgrade
      </button>
    </div>
  );
}
