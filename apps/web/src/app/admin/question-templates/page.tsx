"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TemplateRow {
  _id: string;
  name: string;
  suggestedIndustries: string[];
  questions: { text: string }[];
  usedByCount: number;
}

export default function QuestionTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/question-templates")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Failed to load");
        setTemplates(d.templates ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Question Templates</h1>
          <p className="subtitle">Reusable question sets assigned to businesses.</p>
        </div>
        <Link className="btn btn-dark" href="/admin/question-templates/new">
          + New Template
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {!loading && (
        <div className="grid grid-2">
          {templates.map((t) => (
            <div className="card" key={t._id}>
              <h3>{t.name}</h3>
              <p className="card-sub">
                {t.questions.length} question(s) · used by {t.usedByCount} business(es)
              </p>
              {t.suggestedIndustries.length > 0 && (
                <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
                  Suggested for: {t.suggestedIndustries.join(", ")}
                </p>
              )}
              <Link className="btn btn-sm" href={`/admin/question-templates/${t._id}`}>
                Edit →
              </Link>
            </div>
          ))}
          {templates.length === 0 && <p className="subtitle">No question templates yet.</p>}
        </div>
      )}
    </div>
  );
}
