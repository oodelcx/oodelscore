"use client";

import { useEffect, useRef, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";

interface TourStepData {
  key: string;
  title: string;
  body: string;
}
interface TourData {
  tourId: string;
  tourLabel: string;
  steps: TourStepData[];
}
interface Weights {
  awareness: number;
  response: number;
  ownership: number;
  culture: number;
  outcome: number;
}

const LEVEL_NAMES = ["Collecting", "Reacting", "Responding", "Improving", "Embedded"];
const DIMENSION_LABELS: { key: keyof Weights; label: string }[] = [
  { key: "awareness", label: "Awareness" },
  { key: "response", label: "Response" },
  { key: "ownership", label: "Ownership" },
  { key: "culture", label: "Culture" },
  { key: "outcome", label: "Outcome" },
];
const CONTENT_TABS = [
  { id: "site-name", label: "Site name" },
  { id: "guided-tours", label: "Guided tours" },
  { id: "cx-pulse-ladder", label: "CX Pulse ladder" },
] as const;

function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function resize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    resize(ref.current);
  }, [props.value]);

  const { style, ...rest } = props;
  const mergedStyle = { width: "100%", boxSizing: "border-box", resize: "vertical", overflow: "hidden", ...style } as CSSProperties;

  return <textarea ref={ref} {...rest} style={mergedStyle} onInput={(e) => resize(e.currentTarget)} />;
}

/**
 * The three CMS-editable "admin toys" (site name / browser tab title,
 * guided-tour copy + on/off, CX Pulse ladder descriptions) consolidated
 * onto one page (Phase 4 item 17) — they were previously scattered as
 * top-level nav items competing for attention with billing, escalation and
 * account health. Full site marketing copy stays on its own Site CMS page
 * (too large to fold in here); "Portfolio signals" stays on the CX Pulse
 * Oversight page — this page owns only the editable copy, not operational
 * account data.
 */
export default function AdminContentSettingsPage() {
  const [tab, setTab] = useState<(typeof CONTENT_TABS)[number]["id"]>("site-name");

  return (
    <div>
      <h1>Content settings</h1>
      <p className="subtitle">Site name, guided tour copy, and CX Pulse ladder descriptions — all in one place.</p>

      <div className="cms-tabs" style={{ marginBottom: 16 }}>
        {CONTENT_TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "site-name" && <SiteNameTab />}
      {tab === "guided-tours" && <GuidedToursTab />}
      {tab === "cx-pulse-ladder" && <CxPulseLadderTab />}
    </div>
  );
}

function SiteNameTab() {
  const [siteName, setSiteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-content")
      .then((res) => res.json())
      .then((data) => {
        const menu = (data.pages ?? []).find((p: { page: string }) => p.page === "menu");
        setSiteName(menu?.fields?.siteName ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    // The menu page's PATCH endpoint replaces navItems/sections/fields
    // wholesale, so fetch the current doc fresh and only change siteName —
    // this page never owns the rest of Menu & Footer content (that stays
    // on Site CMS), it just writes into the same field.
    const current = await fetch("/api/admin/site-content").then((r) => r.json());
    const menu = (current.pages ?? []).find((p: { page: string }) => p.page === "menu");
    const res = await fetch("/api/admin/site-content/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        navItems: menu?.navItems ?? [],
        sections: menu?.sections ?? [],
        fields: { ...(menu?.fields ?? {}), siteName },
      }),
    });
    setSaving(false);
    setSavedMsg(res.ok ? "Saved — live in the browser tab title everywhere" : "Failed to save");
  }

  if (loading) return <p className="subtitle">Loading…</p>;

  return (
    <div className="card">
      <div className="field">
        <label>Site name</label>
        <input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        <p className="field-hint">Used as the browser tab title everywhere, and composed into every marketing page&apos;s own title.</p>
      </div>
      {savedMsg && <p style={{ color: "var(--accent, #127C57)", fontSize: 13, margin: "10px 0" }}>{savedMsg}</p>}
      <button className="btn btn-dark" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </button>
      <p className="field-hint" style={{ marginTop: 12 }}>
        Every other piece of marketing copy lives on <a href="/admin/site-content">Site CMS</a>.
      </p>
    </div>
  );
}

function GuidedToursTab() {
  const [tours, setTours] = useState<TourData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [toursEnabled, setToursEnabled] = useState(true);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/admin/tours")
      .then((res) => res.json())
      .then((data) => {
        const list: TourData[] = data.tours ?? [];
        setTours(list);
        setActiveTourId((prev) => prev ?? list[0]?.tourId ?? null);
      })
      .finally(() => setLoading(false));
    fetch("/api/admin/platform-settings")
      .then((res) => res.json())
      .then((data) => setToursEnabled(data.settings?.toursEnabled ?? true));
  }, []);

  async function toggleToursEnabled() {
    setTogglingEnabled(true);
    const next = !toursEnabled;
    const res = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toursEnabled: next }),
    });
    setTogglingEnabled(false);
    if (res.ok) setToursEnabled(next);
  }

  function updateLabel(tourId: string, tourLabel: string) {
    setTours((prev) => prev.map((t) => (t.tourId !== tourId ? t : { ...t, tourLabel })));
  }

  function updateStep(tourId: string, stepKey: string, field: "title" | "body", value: string) {
    setTours((prev) =>
      prev.map((t) => (t.tourId !== tourId ? t : { ...t, steps: t.steps.map((s) => (s.key !== stepKey ? s : { ...s, [field]: value })) }))
    );
  }

  async function save(tourId: string) {
    const tour = tours.find((t) => t.tourId === tourId);
    if (!tour) return;
    setSaving(tourId);
    setSavedMsg(null);
    const res = await fetch(`/api/admin/tours/${tourId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourLabel: tour.tourLabel, steps: tour.steps }),
    });
    setSaving(null);
    setSavedMsg(res.ok ? `${tour.tourLabel} saved` : `Failed to save ${tour.tourLabel}`);
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  const current = tours.find((t) => t.tourId === activeTourId);

  return (
    <div>
      {savedMsg && <p style={{ color: "var(--accent, #127C57)", fontSize: 13, margin: "10px 0" }}>{savedMsg}</p>}

      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Guided tour feature</div>
          <p className="subtitle" style={{ margin: "2px 0 0" }}>
            When off, the &quot;Take a tour&quot; button and every walkthrough below are hidden from all Business and
            Parent Org users platform-wide — the content stays saved, it just isn&apos;t shown.
          </p>
        </div>
        <button
          className={`pill ${toursEnabled ? "pill-green" : "pill-gray"}`}
          style={{ cursor: "pointer", whiteSpace: "nowrap" }}
          disabled={togglingEnabled}
          onClick={toggleToursEnabled}
        >
          {togglingEnabled ? "…" : toursEnabled ? "On — click to disable" : "Off — click to enable"}
        </button>
      </div>

      <div className="cms-tabs" style={{ marginBottom: 16 }}>
        {tours.map((t) => (
          <button
            key={t.tourId}
            className={activeTourId === t.tourId ? "active" : ""}
            onClick={() => {
              setActiveTourId(t.tourId);
              setSavedMsg(null);
            }}
          >
            {t.tourLabel}
          </button>
        ))}
      </div>

      {current && (
        <div className="card">
          <div className="field">
            <label>Trigger label (shown on the &quot;Take a tour&quot; button)</label>
            <input value={current.tourLabel} onChange={(e) => updateLabel(current.tourId, e.target.value)} />
          </div>

          {current.steps.map((step, i) => (
            <div key={step.key} className="card" style={{ marginTop: 14, background: "var(--bg)" }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
                Step {i + 1} of {current.steps.length}
              </div>
              <div className="field">
                <label>Title</label>
                <input value={step.title} onChange={(e) => updateStep(current.tourId, step.key, "title", e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Body</label>
                <AutoTextarea value={step.body} onChange={(e) => updateStep(current.tourId, step.key, "body", e.target.value)} />
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-dark" disabled={saving === current.tourId} onClick={() => save(current.tourId)}>
              {saving === current.tourId ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CxPulseLadderTab() {
  const [weights, setWeights] = useState<Weights | null>(null);
  const [pulseQuestions, setPulseQuestions] = useState("");
  const [levelDescriptions, setLevelDescriptions] = useState<string[]>(["", "", "", "", ""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/cx-pulse-framework")
      .then((r) => r.json())
      .then((frameworkData) => {
        setWeights(frameworkData.framework?.weights ?? null);
        setPulseQuestions((frameworkData.framework?.pulseQuestions ?? []).join("\n"));
        const descs = frameworkData.framework?.levelDescriptions;
        if (Array.isArray(descs) && descs.length === 5) setLevelDescriptions(descs);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!weights) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/cx-pulse-framework", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weights,
        pulseQuestions: pulseQuestions.split("\n").map((q) => q.trim()).filter(Boolean),
        levelDescriptions,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) setError(data.message);
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!weights) return <p className="error-text">Couldn&apos;t load the CX Pulse framework.</p>;

  const total = Object.values(weights).reduce((sum, v) => sum + v, 0);

  return (
    <div className="card">
      <h3>Dimension weights</h3>
      <p className="card-sub">Must sum to 100. Recomputed nightly — a change here applies from the next run.</p>
      <div className="field-row">
        {DIMENSION_LABELS.map((d) => (
          <div className="field" key={d.key}>
            <label>{d.label}</label>
            <input
              type="number"
              value={weights[d.key]}
              onChange={(e) => setWeights((w) => (w ? { ...w, [d.key]: Number(e.target.value) } : w))}
            />
          </div>
        ))}
      </div>
      <p className="field-hint" style={{ color: total !== 100 ? "crimson" : undefined }}>
        Total: {total}
        {total !== 100 ? " — must equal 100" : ""}
      </p>
      <p className="field-hint">Quarterly self-assessment questions (one per line)</p>
      <textarea style={{ width: "100%", minHeight: 80 }} value={pulseQuestions} onChange={(e) => setPulseQuestions(e.target.value)} />

      <p className="field-hint" style={{ marginTop: 16 }}>
        Maturity ladder descriptions — shown under each level on the real CX Pulse page.
      </p>
      {LEVEL_NAMES.map((name, i) => (
        <div className="field" key={name} style={{ marginBottom: 8 }}>
          <label>
            Level {i + 1} · {name}
          </label>
          <input
            value={levelDescriptions[i] ?? ""}
            onChange={(e) =>
              setLevelDescriptions((prev) => {
                const next = [...prev];
                next[i] = e.target.value;
                return next;
              })
            }
          />
        </div>
      ))}
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-dark" style={{ marginTop: 12 }} disabled={saving || total !== 100} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </button>
      <p className="field-hint" style={{ marginTop: 12 }}>
        Account-level maturity data lives on <a href="/admin/cx-pulse">CX Pulse Oversight</a>.
      </p>
    </div>
  );
}
