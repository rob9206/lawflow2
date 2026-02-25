import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeachingPlan, runSeed, startAutoSession, type TeachingTarget } from "@/api/autoTeach";
import { getMastery } from "@/api/progress";
import { masteryColor, cn } from "@/lib/utils";
import { SUBJECTS_REQUIRED, SUBJECT_DESCRIPTIONS, AUTOTEACH_MODE_LABELS } from "@/lib/constants";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import MasteryBar from "@/components/ui/MasteryBar";
import UsageBanner from "@/components/common/UsageBanner";
import {
  Zap,
  ChevronRight,
  Clock,
  ArrowRight,
  BarChart3,
  BookOpen,
  Loader2,
  Scale,
  FileText,
  Gavel,
  ShieldAlert,
  Landmark,
  Home,
  Eye,
  Briefcase,
  Sparkles,
} from "lucide-react";

const SUBJECT_ICONS: Record<string, typeof Scale> = {
  con_law: Landmark,
  contracts: FileText,
  torts: ShieldAlert,
  crim_law: Gavel,
  civ_pro: Scale,
  property: Home,
  evidence: Eye,
  prof_responsibility: Briefcase,
};

const SUBJECT_COLORS: Record<string, { color: string; bg: string }> = {
  con_law: { color: "var(--blue)", bg: "var(--blue-bg)" },
  contracts: { color: "var(--green)", bg: "var(--green-bg)" },
  torts: { color: "var(--red)", bg: "var(--red-bg)" },
  crim_law: { color: "var(--orange)", bg: "var(--orange-bg)" },
  civ_pro: { color: "var(--purple)", bg: "var(--purple-bg)" },
  property: { color: "var(--gold)", bg: "var(--gold-bg)" },
  evidence: { color: "var(--navy)", bg: "var(--navy-bg)" },
  prof_responsibility: { color: "var(--blue-dark)", bg: "var(--blue-bg-subtle)" },
};

const SUBJECT_VALUES = new Set<string>(SUBJECTS_REQUIRED.map((s) => s.value));

export default function AutoTeachPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectFromUrl = searchParams.get("subject");
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(() =>
    subjectFromUrl && SUBJECT_VALUES.has(subjectFromUrl) ? subjectFromUrl : null
  );
  const [availableMinutes, setAvailableMinutes] = useState<number>(60);

  const [streaming, setStreaming] = useState(false);
  const [streamingTopic, setStreamingTopic] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const { data: masteryData } = useQuery({
    queryKey: ["mastery"],
    queryFn: getMastery,
  });

  const { data: plan, isLoading: planLoading, isError: planError, error: planErrorDetail } = useQuery({
    queryKey: ["teaching-plan", selectedSubject, availableMinutes],
    queryFn: () => getTeachingPlan(selectedSubject!, { available_minutes: availableMinutes }),
    enabled: !!selectedSubject,
  });

  useEffect(() => {
    if (subjectFromUrl && SUBJECT_VALUES.has(subjectFromUrl) && !selectedSubject) {
      setSelectedSubject(subjectFromUrl);
    }
  }, [subjectFromUrl, selectedSubject]);

  const startSession = async (topic?: string) => {
    if (!selectedSubject) return;

    setStreaming(true);
    setStreamingTopic(topic ?? null);
    setSessionError(null);

    try {
      await startAutoSession(
        selectedSubject,
        topic,
        undefined,
        (sid) => {
          navigate(`/auto-teach/session/${sid}`);
        },
        availableMinutes,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start session";
      setSessionError(msg);
    } finally {
      setStreaming(false);
      setStreamingTopic(null);
    }
  };

  const handleSeed = async () => {
    setSeedError(null);
    setSeeding(true);
    try {
      await runSeed();
      await queryClient.invalidateQueries({ queryKey: ["teaching-plan"] });
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          icon={<Zap size={24} />}
          title="AutoTeach"
          subtitle="AI-optimized study sessions that teach you exactly what you need"
        />
      </div>

      <UsageBanner feature="auto_teach_sessions_daily" />

      {/* Subject picker */}
      {!selectedSubject && (
        <Card padding="md" className="mb-5 animate-fade-up flex items-center gap-3" style={{ background: "var(--blue-bg-subtle)", borderColor: "var(--blue)" }}>
          <Sparkles size={18} style={{ color: "var(--blue)" }} />
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--blue-dark)" }}>
            Pick a subject below and AutoTeach will build an optimized study plan based on your weakest topics.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-3 mb-6">
        {SUBJECTS_REQUIRED.map((s) => {
          const m = masteryData?.find((x) => x.subject === s.value);
          const active = selectedSubject === s.value;
          const mastery = m?.mastery_score ?? 0;
          const SubjectIcon = SUBJECT_ICONS[s.value] || BookOpen;
          const colors = SUBJECT_COLORS[s.value] || { color: "var(--text-muted)", bg: "var(--surface-bg)" };
          const isWeakest =
            !selectedSubject &&
            masteryData &&
            masteryData.length > 0 &&
            masteryData.every((x) => mastery <= x.mastery_score);
          return (
            <Card
              key={s.value}
              hover
              padding="none"
              className={cn(
                "text-left px-4 py-3.5 cursor-pointer transition-all relative",
                active && "!border-[var(--green)] !bg-[var(--green-bg-subtle)]"
              )}
              onClick={() => setSelectedSubject(s.value)}
            >
              {isWeakest && (
                <span
                  className="absolute -top-2 -right-2 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: "var(--orange)", color: "white" }}
                >
                  Focus
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    background: active ? "var(--green-bg)" : colors.bg,
                  }}
                >
                  <SubjectIcon
                    size={17}
                    style={{ color: active ? "var(--green-dark)" : colors.color }}
                  />
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    color: active ? "var(--green-dark)" : "var(--text-primary)",
                    lineHeight: 1.2,
                  }}
                >
                  {s.label}
                </p>
              </div>
              <p
                className="mb-2"
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {SUBJECT_DESCRIPTIONS[s.value] || ""}
              </p>
              <MasteryBar score={mastery} size="sm" />
              <p
                className="mt-1"
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: m ? masteryColor(mastery) : "var(--text-muted)",
                }}
              >
                {m ? `${mastery.toFixed(0)}% mastery` : "Not started"}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Time budget */}
      {selectedSubject && (
        <Card className="flex items-center gap-4 mb-6">
          <Clock size={18} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>I have</span>
          <div className="flex gap-2">
            {[30, 60, 90, 120].map((mins) => (
              <button
                key={mins}
                onClick={() => setAvailableMinutes(mins)}
                className="transition-all"
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "14px",
                  fontWeight: 700,
                  backgroundColor: availableMinutes === mins ? "var(--green-bg)" : "var(--surface-bg)",
                  color: availableMinutes === mins ? "var(--green-dark)" : "var(--text-secondary)",
                  border: `2px solid ${availableMinutes === mins ? "var(--green)" : "var(--border)"}`,
                }}
              >
                {mins}m
              </button>
            ))}
          </div>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>to study</span>
        </Card>
      )}

      {planLoading && (
        <div className="animate-pulse" style={{ color: "var(--text-muted)" }}>Computing optimal study plan...</div>
      )}

      {/* Seed prompt when plan is empty */}
      {selectedSubject && !planLoading && !planError && (!plan || plan.teaching_plan.length === 0) && (
        <Card className="mb-6 p-6" style={{ borderColor: "var(--orange)", backgroundColor: "var(--orange-bg)" }}>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>No study plan yet</p>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "16px" }}>
            {plan?.message ?? "The database needs to be seeded with subjects and topics. Click below to run the seed (safe to run anytime)."}
          </p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="duo-btn duo-btn-orange"
          >
            {seeding ? "Seeding…" : "Seed database"}
          </button>
          {seedError && <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--red)" }}>{seedError}</p>}
        </Card>
      )}

      {planError && (
        <Card className="text-center py-8" style={{ borderColor: "var(--red)", backgroundColor: "var(--red-bg)" }}>
          <p style={{ fontWeight: 700, color: "var(--red)", marginBottom: "4px" }}>Couldn&apos;t load study plan</p>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            {planErrorDetail instanceof Error ? planErrorDetail.message : "Check your connection and try again."}
          </p>
        </Card>
      )}

      {plan && plan.teaching_plan.length === 0 && !planError && (
        <Card className="text-center py-8" style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          <p className="mb-4">
            {plan.message ?? "No study topics found for this subject. The database may still be initializing — try refreshing in a moment."}
          </p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="duo-btn duo-btn-orange"
          >
            {seeding ? "Seeding…" : "Seed database"}
          </button>
          {seedError && <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--red)" }}>{seedError}</p>}
        </Card>
      )}

      {plan && plan.teaching_plan.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
              Study Plan — {plan.subject_display}
            </h3>
            <div className="flex items-center gap-4" style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {plan.total_estimated_minutes}m total
              </span>
              {plan.has_exam_data && (
                <span className="flex items-center gap-1" style={{ color: "var(--gold)" }}>
                  <BarChart3 size={14} />
                  Exam-optimized
                </span>
              )}
            </div>
          </div>

          {sessionError && (
            <Card className="mb-4" style={{ backgroundColor: "var(--red-bg)", borderColor: "var(--red)", fontSize: "14px", color: "var(--red)" }}>
              {sessionError}
            </Card>
          )}

          {plan.auto_session && (
            <button
              onClick={() => startSession()}
              disabled={streaming}
              className="duo-btn duo-btn-green w-full mb-6 flex items-center justify-center gap-3"
              style={{ padding: "16px 24px", fontSize: "16px" }}
            >
              {streaming ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Preparing your session…
                </>
              ) : (
                <>
                  <Zap size={20} />
                  Start Studying — {plan.teaching_plan[0]?.display_name}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          )}

          {streaming && (
            <Card className="mb-6 flex items-center gap-4" style={{ borderColor: "var(--green)", backgroundColor: "var(--green-bg)" }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--green-dark)" }} />
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--green-dark)" }}>
                  Setting up your study session
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  The AI is analyzing your progress and preparing personalized content…
                </p>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {plan.teaching_plan.map((target, i) => (
              <TopicRow
                key={target.topic}
                target={target}
                rank={i + 1}
                hasExamData={plan.has_exam_data}
                onStart={() => startSession(target.topic)}
                disabled={streaming}
                loading={streamingTopic === target.topic}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopicRow({
  target,
  rank,
  hasExamData,
  onStart,
  disabled,
  loading,
}: {
  target: TeachingTarget;
  rank: number;
  hasExamData: boolean;
  onStart: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ fontSize: "14px", fontWeight: 800, backgroundColor: "var(--surface-bg)", color: "var(--text-muted)" }}
      >
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>{target.display_name}</p>
          <Badge style={{ color: masteryColor(target.mastery) }}>
            {target.mastery.toFixed(0)}%
          </Badge>
          <Badge>
            {AUTOTEACH_MODE_LABELS[target.recommended_mode] || target.recommended_mode}
          </Badge>
        </div>
        <p style={{ fontSize: "12px", marginTop: "2px", color: "var(--text-muted)" }}>
          {loading ? "Starting session…" : target.mode_reason}
          {!loading && hasExamData && ` · ${(target.exam_weight * 100).toFixed(0)}% of exam`}
        </p>
      </div>

      <div className="text-right shrink-0" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        <p>{target.time_estimate_minutes}m</p>
        {target.knowledge_chunks_available > 0 && (
          <p className="flex items-center gap-1 justify-end">
            <BookOpen size={10} />
            {target.knowledge_chunks_available} chunks
          </p>
        )}
      </div>

      <button
        onClick={onStart}
        disabled={disabled}
        title="Start session for topic"
        aria-label="Start session for topic"
        className="shrink-0 p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "var(--surface-bg)", color: "var(--text-muted)" }}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
      </button>
    </Card>
  );
}
