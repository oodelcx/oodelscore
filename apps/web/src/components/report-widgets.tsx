"use client";

import type { ReactNode, CSSProperties } from "react";

/**
 * Shared presentational pieces for the Business/Group Reports pages —
 * pulled out so both stop being plain HTML tables and metric grids and
 * instead read as one deliberately-designed report: colored KPI tiles,
 * horizontal bar rows scored against real thresholds (not just a raw
 * number), and stacked sentiment bars for themes. Print-safe — no
 * animation, colors survive `prefers-color-scheme` and browser printing.
 */

export function ReportHero({ title, badge, subtitle }: { title: string; badge?: ReactNode; subtitle: string }) {
  return (
    <div className="rpt-hero">
      <div className="rpt-hero-title">
        <h2>
          {title}
          {badge}
        </h2>
        <p className="subtitle" style={{ margin: 0 }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export type KpiTone = "good" | "warn" | "bad" | "neutral";

export function starTone(value: number | null): KpiTone {
  if (value === null) return "neutral";
  if (value >= 4) return "good";
  if (value >= 3) return "warn";
  return "bad";
}
export function npsTone(value: number | null): KpiTone {
  if (value === null) return "neutral";
  if (value >= 30) return "good";
  if (value >= 0) return "warn";
  return "bad";
}

interface KpiItem {
  label: string;
  value: string;
  tone?: KpiTone;
  icon?: string;
}

export function ReportKpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="rpt-kpi-grid">
      {items.map((it) => (
        <div className="rpt-kpi" key={it.label} style={{ "--rpt-tone": `var(--rpt-${it.tone ?? "neutral"})` } as CSSProperties}>
          {it.icon && <div className="rpt-kpi-icon">{it.icon}</div>}
          <div className="rpt-kpi-label">{it.label}</div>
          <div className="rpt-kpi-val">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

interface BarRow {
  key: string;
  label: string;
  sublabel?: string;
  value: number | null;
  max: number;
  displayValue: string;
  tone: KpiTone;
}

export function ReportBarList({ title, rows, emptyText }: { title: string; rows: BarRow[]; emptyText: string }) {
  return (
    <div className="rpt-section">
      <div className="section-title">{title}</div>
      {rows.length === 0 && <p className="subtitle">{emptyText}</p>}
      {rows.length > 0 && (
        <div className="rpt-bar-list">
          {rows.map((r) => (
            <div className="rpt-bar-row" key={r.key}>
              <div className="rpt-bar-row-label">
                <span>{r.label}</span>
                {r.sublabel && <span className="rpt-bar-row-sublabel">{r.sublabel}</span>}
              </div>
              <div className="rpt-bar-track">
                <div
                  className="rpt-bar-fill"
                  style={{
                    width: r.value === null ? "0%" : `${Math.max(4, Math.min(100, (r.value / r.max) * 100))}%`,
                    background: `var(--rpt-${r.tone})`,
                  }}
                />
              </div>
              <div className="rpt-bar-value">{r.displayValue}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ThemeSentimentRow {
  theme: string;
  frequency: number;
  positive: number;
  neutral: number;
  negative: number;
}

export function ReportThemeList({ rows, emptyText }: { rows: ThemeSentimentRow[]; emptyText: string }) {
  return (
    <div className="rpt-section">
      <div className="section-title">Top themes</div>
      {rows.length === 0 && <p className="subtitle">{emptyText}</p>}
      {rows.length > 0 && (
        <div className="rpt-theme-list">
          {rows.map((t) => {
            const total = t.positive + t.neutral + t.negative || 1;
            return (
              <div className="rpt-theme-card" key={t.theme}>
                <div className="rpt-theme-head">
                  <b>{t.theme}</b>
                  <span className="subtitle" style={{ margin: 0 }}>
                    {t.frequency} mention{t.frequency === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="rpt-sentiment-track">
                  <div className="rpt-sentiment-seg" style={{ width: `${(t.positive / total) * 100}%`, background: "var(--rpt-good)" }} />
                  <div className="rpt-sentiment-seg" style={{ width: `${(t.neutral / total) * 100}%`, background: "var(--rpt-warn)" }} />
                  <div className="rpt-sentiment-seg" style={{ width: `${(t.negative / total) * 100}%`, background: "var(--rpt-bad)" }} />
                </div>
                <div className="rpt-sentiment-legend">
                  <span>
                    <i style={{ background: "var(--rpt-good)" }} /> {t.positive} positive
                  </span>
                  <span>
                    <i style={{ background: "var(--rpt-warn)" }} /> {t.neutral} neutral
                  </span>
                  <span>
                    <i style={{ background: "var(--rpt-bad)" }} /> {t.negative} negative
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
