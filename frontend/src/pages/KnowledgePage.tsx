import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { KnowledgeChunk } from "@/types";
import { Search, FileText, Tag, Upload, Brain, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function KnowledgePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [contentType, setContentType] = useState("");

  const { data: chunks = [], isLoading } = useQuery({
    queryKey: ["knowledge", query, subject, contentType],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (query) params.q = query;
      if (subject) params.subject = subject;
      if (contentType) params.content_type = contentType;
      const { data } = await api.get<KnowledgeChunk[]>("/knowledge/search", { params });
      return data;
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["knowledge-subjects"],
    queryFn: async () => {
      const { data } = await api.get("/knowledge/subjects");
      return data as { subject: string; chunk_count: number }[];
    },
  });

  return (
    <div>
      <PageHeader title="Knowledge Base" />

      <div className="flex gap-3 mb-6 mt-6">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge chunks..."
            className="duo-input w-full pl-9 pr-3 py-2"
            style={{ fontSize: 14 }}
          />
        </div>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="Filter by subject"
          className="duo-input px-3 py-2"
          style={{ fontSize: 14 }}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subject} value={s.subject}>
              {s.subject} ({s.chunk_count})
            </option>
          ))}
        </select>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          aria-label="Filter by content type"
          className="duo-input px-3 py-2"
          style={{ fontSize: 14 }}
        >
          <option value="">All types</option>
          <option value="rule">Rules</option>
          <option value="case">Cases</option>
          <option value="concept">Concepts</option>
          <option value="procedure">Procedures</option>
          <option value="definition">Definitions</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12">
          <Search size={16} className="animate-spin" style={{ color: "var(--blue)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>Searching...</span>
        </div>
      ) : chunks.length === 0 ? (
        <Card padding="lg" className="text-center animate-fade-up" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-full"
            style={{ width: 72, height: 72, background: "var(--purple-bg)" }}
          >
            <Brain size={36} style={{ color: "var(--purple)" }} />
          </div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            Your knowledge base is empty
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            When you upload documents, LawFlow's AI extracts every rule, case holding, concept, and definition into searchable knowledge chunks.
            These power your tutoring sessions, flashcards, and exam prep.
          </p>
          <div className="flex items-center justify-center gap-4 mb-5">
            {[
              { icon: FileText, label: "Rules", color: "var(--blue)" },
              { icon: BookOpen, label: "Cases", color: "var(--green)" },
              { icon: Sparkles, label: "Concepts", color: "var(--purple)" },
              { icon: Tag, label: "Definitions", color: "var(--orange)" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1.5">
                <t.icon size={13} style={{ color: t.color }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: t.color }}>{t.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/documents")}
            className="duo-btn duo-btn-green flex items-center gap-2 mx-auto"
          >
            <Upload size={16} />
            Upload Documents
            <ArrowRight size={16} />
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          {chunks.map((chunk) => (
            <Card key={chunk.id}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="blue">{chunk.subject}</Badge>
                {chunk.topic && <Badge>{chunk.topic}</Badge>}
                <Badge>{chunk.content_type}</Badge>
                {chunk.case_name && (
                  <Badge variant="orange" className="flex items-center gap-1">
                    <Tag size={10} />
                    {chunk.case_name}
                  </Badge>
                )}
              </div>
              {chunk.summary && (
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: "var(--text-secondary)" }}>
                  {chunk.summary}
                </p>
              )}
              <p className="line-clamp-3" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>
                {chunk.content}
              </p>
              {chunk.key_terms.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {chunk.key_terms.map((term) => (
                    <Badge key={term} className="text-[10px]">
                      {term}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
