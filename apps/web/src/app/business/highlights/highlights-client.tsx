"use client";

import { useEffect, useState } from "react";

interface HighlightQuote {
  id: string;
  businessId: string;
  businessName: string;
  quote: string;
  starValue: number | null;
  npsValue: number | null;
  themes: string[];
  submittedAt: string;
}
interface PositiveThemeEntry {
  theme: string;
  frequency: number;
  positiveShare: number;
  representativeQuote: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function BusinessHighlightsClient() {
  const [quotes, setQuotes] = useState<HighlightQuote[]>([]);
  const [topThemes, setTopThemes] = useState<PositiveThemeEntry[]>([]);
  const [positiveResponseCount, setPositiveResponseCount] = useState(0);
  const [totalResponseCount, setTotalResponseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/highlights")
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Unable to load Highlights.");
          return;
        }
        setQuotes(data.quotes ?? []);
        setTopThemes(data.topThemes ?? []);
        setPositiveResponseCount(data.positiveResponseCount ?? 0);
        setTotalResponseCount(data.totalResponseCount ?? 0);
      })
      .catch(() => setError("Unable to load Highlights."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Highlights</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>
            The other side of feedback — strong reviews and recurring positive themes from the last 90 days, not just
            what needs fixing.
          </p>
        </div>
      </div>
      {error && <p style={{ color: "var(--red, #b3261e)" }}>{error}</p>}
      {!error && !loading && totalResponseCount > 0 && (
        <p className="subtitle" style={{ marginTop: -8, marginBottom: 20 }}>
          {positiveResponseCount} of {totalResponseCount} responses in this window read as positive.
        </p>
      )}
      {!error && (
        <>
          {topThemes.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3>What's working, recurring</h3>
              <div className="qrow-top" style={{ flexWrap: "wrap", gap: 10 }}>
                {topThemes.map((t) => (
                  <span className="pill pill-green" key={t.theme} title={t.representativeQuote ?? undefined}>
                    {t.theme} · {t.frequency}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3>Recent positive feedback</h3>
            {loading && <p className="subtitle">Loading…</p>}
            {!loading && quotes.length === 0 && <p className="subtitle">No standout positive feedback with a comment yet in this window.</p>}
            {quotes.map((q) => (
              <div className="qrow" key={q.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <p style={{ margin: 0, flex: 1 }}>&ldquo;{q.quote}&rdquo;</p>
                  <span style={{ color: "var(--text-3)", whiteSpace: "nowrap", fontSize: 12.5 }}>{formatDate(q.submittedAt)}</span>
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {q.starValue !== null && <span className="pill pill-gray">{q.starValue}★</span>}
                  {q.npsValue !== null && <span className="pill pill-gray">NPS {q.npsValue}</span>}
                  {q.themes.map((t) => (
                    <span className="pill pill-gray" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
