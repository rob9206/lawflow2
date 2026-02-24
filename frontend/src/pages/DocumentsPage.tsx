import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone, FileRejection } from "react-dropzone";
import { listDocuments, uploadDocument, deleteDocument } from "@/api/documents";
import { convertDocument, downloadConvertedFile } from "@/api/converter";
import { formatDate } from "@/lib/utils";
import { SUBJECTS_WITH_AUTODETECT, DOC_TYPES } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  BookOpen,
  Presentation,
  FileCheck,
  ClipboardList,
  Brain,
  Sparkles,
  Zap,
  GraduationCap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

const DOC_TYPE_GUIDE = [
  {
    icon: BookOpen,
    label: "Casebook / Textbook",
    value: "casebook",
    color: "var(--blue)",
    bg: "var(--blue-bg)",
    description: "Upload your casebooks to extract case holdings, rules, and legal principles.",
    unlocks: ["Case-specific tutoring", "IRAC practice with real holdings", "Issue spotting drills"],
  },
  {
    icon: Presentation,
    label: "Lecture Slides",
    value: "slides",
    color: "var(--green)",
    bg: "var(--green-bg)",
    description: "Upload lecture slides to capture key rules, definitions, and professor emphasis.",
    unlocks: ["Focused review sessions", "Flashcards from key slides", "Exam strategy aligned to lectures"],
  },
  {
    icon: FileCheck,
    label: "Outline / Notes",
    value: "outline",
    color: "var(--purple)",
    bg: "var(--purple-bg)",
    description: "Upload your outlines and notes for personalized review and gap analysis.",
    unlocks: ["Gap analysis vs. full subject", "Smart review scheduling", "Knowledge graph connections"],
  },
  {
    icon: ClipboardList,
    label: "Past Exam",
    value: "exam",
    color: "var(--orange)",
    bg: "var(--orange-bg)",
    description: "Upload past exams to unlock targeted exam prep and professor pattern analysis.",
    unlocks: ["Professor pattern detection", "High-yield topic identification", "Exam simulation calibrated to your course"],
  },
] as const;

const PIPELINE_STEPS = [
  {
    step: 1,
    icon: Upload,
    title: "Upload",
    description: "Drop your PDF, PPTX, or DOCX files",
    color: "var(--blue)",
    bg: "var(--blue-bg)",
  },
  {
    step: 2,
    icon: Brain,
    title: "AI Analysis",
    description: "Claude extracts and tags every concept",
    color: "var(--purple)",
    bg: "var(--purple-bg)",
  },
  {
    step: 3,
    icon: Sparkles,
    title: "Knowledge Built",
    description: "Topics, rules, and cases are structured",
    color: "var(--green)",
    bg: "var(--green-bg)",
  },
  {
    step: 4,
    icon: GraduationCap,
    title: "Study Smarter",
    description: "Personalized tutoring, flashcards & exams",
    color: "var(--gold)",
    bg: "var(--gold-bg)",
  },
] as const;

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [docType, setDocType] = useState("");
  const [convertingDoc, setConvertingDoc] = useState<string | null>(null);
  const [showConvertMenu, setShowConvertMenu] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowConvertMenu(null);
      }
    };

    if (showConvertMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showConvertMenu]);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => listDocuments(),
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument(file, subject || undefined, docType || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const handleConvert = async (docId: string, format: "pdf" | "png" | "txt" | "md") => {
    setConvertingDoc(docId);
    setShowConvertMenu(null);
    try {
      const result = await convertDocument(docId, format);

      if (result.download_url) {
        const filename = result.download_url.split("/").pop();
        if (filename) {
          const downloadUrl = downloadConvertedFile(docId, filename);
          window.open(downloadUrl, "_blank");
        }
      }

      alert(result.message);
    } catch (error: any) {
      alert(`Conversion failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setConvertingDoc(null);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      for (const file of acceptedFiles) {
        uploadMutation.mutate(file);
      }
      for (const rejection of fileRejections) {
        if (rejection.errors.some((e) => e.code === "file-invalid-type")) {
          const ext = rejection.file.name.split(".").pop()?.toLowerCase();
          if (ext === "pptx" || ext === "pdf" || ext === "docx") {
            uploadMutation.mutate(rejection.file);
          }
        }
      }
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.ms-powerpoint": [".pptx"],
      "application/octet-stream": [".pptx"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".docx"],
    },
    maxSize: 100 * 1024 * 1024,
  });

  const hasDocuments = docs.length > 0;

  return (
    <div>
      <PageHeader
        icon={<FileText size={24} />}
        title="Documents"
        subtitle="Upload your course materials to unlock AI-powered, personalized study sessions"
      />

      {/* ── How It Works Pipeline ─────────────────────── */}
      {!hasDocuments && (
        <div className="animate-fade-up mt-6">
          <Card padding="lg">
            <div className="flex items-center gap-2 mb-5">
              <Zap size={18} style={{ color: "var(--gold)" }} />
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>
                How It Works
              </h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {PIPELINE_STEPS.map((s, i) => (
                <div key={s.step} className="relative text-center">
                  <div
                    className="mx-auto mb-3 flex items-center justify-center rounded-2xl"
                    style={{
                      width: 56,
                      height: 56,
                      background: s.bg,
                    }}
                  >
                    <s.icon size={26} style={{ color: s.color }} />
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>
                    {s.title}
                  </p>
                  <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {s.description}
                  </p>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <ArrowRight
                      size={16}
                      className="absolute top-5 -right-2.5"
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Upload Zone (enhanced) ────────────────────── */}
      <Card padding="lg" className="mt-5 mb-5 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="duo-label" style={{ marginBottom: "4px", display: "block" }}>
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="duo-input w-full"
              aria-label="Subject"
            >
              {SUBJECTS_WITH_AUTODETECT.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="duo-label" style={{ marginBottom: "4px", display: "block" }}>
              Document Type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="duo-input w-full"
              aria-label="Document Type"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          {...getRootProps()}
          className="border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all"
          style={{
            borderColor: isDragActive ? "var(--green)" : "var(--border)",
            backgroundColor: isDragActive ? "var(--green-bg-subtle)" : "var(--surface-bg)",
            padding: hasDocuments ? "28px 24px" : "44px 24px",
          }}
        >
          <input {...getInputProps()} />
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-full"
            style={{
              width: 64,
              height: 64,
              background: isDragActive ? "var(--green-bg)" : "var(--card-bg)",
              border: `2px solid ${isDragActive ? "var(--green)" : "var(--border)"}`,
              transition: "all 0.15s",
            }}
          >
            <Upload
              size={28}
              style={{
                color: isDragActive ? "var(--green)" : "var(--text-muted)",
                transition: "color 0.15s",
              }}
            />
          </div>
          <p style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            {isDragActive ? "Drop your files here!" : "Drag & drop your course materials"}
          </p>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
            or click to browse your files
          </p>
          <div className="flex items-center justify-center gap-3">
            {[
              { ext: "PDF", color: "var(--red)" },
              { ext: "PPTX", color: "var(--orange)" },
              { ext: "DOCX", color: "var(--blue)" },
            ].map((f) => (
              <span
                key={f.ext}
                className="inline-flex items-center gap-1 rounded-full"
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: f.color,
                  background: `color-mix(in srgb, ${f.color} 12%, transparent)`,
                  letterSpacing: "0.04em",
                }}
              >
                <FileText size={12} />
                {f.ext}
              </span>
            ))}
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
              up to 100 MB
            </span>
          </div>
        </div>

        {uploadMutation.isPending && (
          <div
            className="flex items-center gap-2 mt-3 rounded-lg"
            style={{ padding: "10px 14px", background: "var(--blue-bg-subtle)" }}
          >
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--blue)" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--blue-dark)" }}>
              Uploading...
            </span>
          </div>
        )}
      </Card>

      {/* ── What to Upload Guide (collapsible) ────────── */}
      <div className="mb-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-2 w-full text-left mb-3"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Info size={16} style={{ color: "var(--blue)" }} />
          <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)" }}>
            What should I upload?
          </span>
          {showGuide ? (
            <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
          )}
        </button>

        {showGuide && (
          <div className="grid grid-cols-2 gap-3 animate-slide-down">
            {DOC_TYPE_GUIDE.map((dt) => (
              <Card key={dt.value} hover padding="md">
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 flex items-center justify-center rounded-xl"
                    style={{ width: 44, height: 44, background: dt.bg }}
                  >
                    <dt.icon size={22} style={{ color: dt.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                      {dt.label}
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>
                      {dt.description}
                    </p>
                    <div className="flex flex-col gap-1">
                      {dt.unlocks.map((u) => (
                        <div key={u} className="flex items-center gap-1.5">
                          <Sparkles size={11} style={{ color: dt.color, flexShrink: 0 }} />
                          <span style={{ fontSize: "12px", fontWeight: 700, color: dt.color }}>
                            {u}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Document List ─────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--blue)" }} />
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading documents...</span>
        </div>
      ) : hasDocuments ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>
              Your Library
            </h3>
            <Badge variant="blue">{docs.length} document{docs.length !== 1 ? "s" : ""}</Badge>
          </div>
          <div className="space-y-2">
            {docs.map((doc) => (
              <Card key={doc.id} padding="none" hover className="px-4 py-3 flex items-center gap-4">
                <div
                  className="shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 36,
                    height: 36,
                    background:
                      doc.file_type === "pdf"
                        ? "var(--red-bg)"
                        : doc.file_type === "pptx"
                          ? "var(--orange-bg)"
                          : "var(--blue-bg)",
                  }}
                >
                  <FileText
                    size={18}
                    style={{
                      color:
                        doc.file_type === "pdf"
                          ? "var(--red)"
                          : doc.file_type === "pptx"
                            ? "var(--orange)"
                            : "var(--blue)",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {doc.filename}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {doc.subject || "auto-detect"} · {doc.file_type?.toUpperCase()} · {formatDate(doc.created_at)}
                  </p>
                </div>
                <StatusBadge
                  status={doc.processing_status}
                  chunks={doc.total_chunks}
                  errorMessage={doc.error_message}
                />

                {doc.file_type === "pptx" && (
                  <div className="relative" ref={showConvertMenu === doc.id ? menuRef : null}>
                    <button
                      onClick={() => setShowConvertMenu(showConvertMenu === doc.id ? null : doc.id)}
                      disabled={convertingDoc === doc.id}
                      className="p-1.5 transition-colors rounded"
                      style={{ color: "var(--blue-dark)" }}
                      title="Convert to another format"
                    >
                      {convertingDoc === doc.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                    </button>

                    {showConvertMenu === doc.id && (
                      <Card
                        padding="none"
                        className="absolute right-0 mt-1 py-1 shadow-lg z-10"
                        style={{ minWidth: "160px" }}
                      >
                        {(["pdf", "png", "txt", "md"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => handleConvert(doc.id, fmt)}
                            className="w-full text-left px-3 py-2 transition-colors"
                            style={{ fontSize: "14px", color: "var(--text-primary)" }}
                          >
                            Convert to {fmt === "png" ? "Images" : fmt === "txt" ? "Text" : fmt === "md" ? "Markdown" : "PDF"}
                          </button>
                        ))}
                      </Card>
                    )}
                  </div>
                )}

                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="p-1.5 transition-colors rounded-lg"
                  style={{ color: "var(--text-muted)" }}
                  title="Delete document"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card padding="lg" className="text-center animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-full"
            style={{ width: 72, height: 72, background: "var(--green-bg-subtle)" }}
          >
            <GraduationCap size={36} style={{ color: "var(--green)" }} />
          </div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            Start with your course materials
          </p>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              maxWidth: 420,
              margin: "0 auto 16px",
              lineHeight: 1.5,
            }}
          >
            Upload a casebook, lecture slides, outline, or past exam above.
            LawFlow's AI will analyze every concept and build a personalized study plan just for you.
          </p>
          <div className="flex items-center justify-center gap-6">
            {[
              { icon: Brain, label: "AI Tutoring", color: "var(--purple)" },
              { icon: Sparkles, label: "Smart Flashcards", color: "var(--blue)" },
              { icon: ClipboardList, label: "Exam Prep", color: "var(--orange)" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-1.5">
                <f.icon size={14} style={{ color: f.color }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: f.color }}>{f.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  chunks,
  errorMessage,
}: {
  status: string;
  chunks: number;
  errorMessage?: string | null;
}) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="green" className="flex items-center gap-1.5">
          <CheckCircle size={12} />
          {chunks} chunks
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="blue" className="flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Processing
        </Badge>
      );
    case "error":
      return (
        <Badge variant="red" className="flex items-center gap-1.5 max-w-xs" title={errorMessage || "Processing failed"}>
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{errorMessage || "Error"}</span>
        </Badge>
      );
    default:
      return (
        <Badge>Pending</Badge>
      );
  }
}
