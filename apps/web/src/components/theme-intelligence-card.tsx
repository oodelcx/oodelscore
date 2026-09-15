"use client";

import { useEffect, useState } from "react";

interface ThemeRow {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  trend: "up" | "down" | "flat" | null;
  representativeQuote: string | null;
}

const TREND_ICON: Record<string, string> = { up: "↑", down: "↓", flat: "→" };

function dominantSentimentColor(s: ThemeRow["sentimentBreakdown"]): string {
  if (s.negative >= s.positive && s.negative >= s.neutral) return "var(--red)";
  if (s.positive >= s.neutral) return "var(--green)";
  return "var(--text-3)";
}

/** Shared by Business and Group Analytics — what people are actually talking about, extracted from open-ended feedback by Claude Haiku (with a keyword fallback when no API key is configured). */
export function ThemeIntelligenceCard({ apiPath, analyzeApiPath }: { apiPath: string; analyzeApiPath: string }) {
  const [themes, setThemes] = useState<ThemeRow[] | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string | null>(null);

  function load() {
    fetch(apiPath)
      .then((res) => res.json())
      .then((d) => {
        setThemes(d.themes ?? []);
        if (d.windowDays) setWindowDays(d.windowDays);
      });
  }

  useEffect(load, [apiPath]);

  async function runAnalyze() {
    setAnalyzing(true);
    setAnalyzeStatus(null);
    const res = await fetch(analyzeApiPath, { method: "POST" });
    const data = await res.json().catch(() => null);
    setAnalyzing(false);
    if (!res.ok) {
      setAnalyzeStatus("Failed to analyze feedback");
      return;
    }
    setAnalyzeStatus(
      data.analyzed === 0 && data.remaining === 0
        ? "Everything is already analyzed"
        : `Analyzed ${data.analyzed} response${data.analyzed === 1 ? "" : "s"}${data.remaining > 0 ? ` · ${data.remaining} more remaining, click again` : ""}`
    );
    load();
  }

  return (
    <div className="card">
      <div className="page-head" style={{ marginBottom: 6 }}>
        <div>
          <h3 style={{ margin: 0 }}>Theme &amp; Sentiment Intelligence</h3>
          <p className="card-sub" style={{ margin: 0 }}>
            What people are actually talking about, over the last {windowDays} days — extracted from open-ended answers.
          </p>
        </div>
        <button className="btn btn-sm" disabled={analyzing} onClick={runAnalyze}>
          {analyzing ? "Analyzing…" : "Analyze feedback"}
        </button>
      </div>
      {analyzeStatus && <p className="subtitle">{analyzeStatus}</p>}

      {themes === null && <p className="subtitle">Loading…</p>}
      {themes !== null && themes.length === 0 && (
        <p className="subtitle">
          No themes yet — comments need to be analyzed first. Click &ldquo;Analyze feedback&rdquo; to process existing responses.
        </p>
      )}
      {themes !== null &&
        themes.map((t) => (
          <div key={t.theme} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line, #e4e2dc)" }}>
            <div className="page-head" style={{ marginBottom: 4 }}>
              <div>
                <b style={{ textTransform: "capitalize" }}>{t.theme}</b>
                <span className="subtitle" style={{ marginLeft: 8 }}>
                  {t.frequency} mention{t.frequency === 1 ? "" : "s"}
                </span>
                {t.trend && (
                  <span className="subtitle" style={{ marginLeft: 8, color: dominantSentimentColor(t.sentimentBreakdown) }}>
                    {TREND_ICON[t.trend]}
                  </span>
                )}
              </div>
              <div className="subtitle">
                {t.sentimentBreakdown.positive}+ · {t.sentimentBreakdown.neutral}~ · {t.sentimentBreakdown.negative}-
              </div>
            </div>
            {t.representativeQuote && <div style={{ fontSize: 13, color: "var(--text-2, #55584f)" }}>&ldquo;{t.representativeQuote}&rdquo;</div>}
          </div>
        ))}
    </div>
  );
}
