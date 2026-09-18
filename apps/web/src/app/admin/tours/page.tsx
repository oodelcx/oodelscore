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
 * Admin -> Guided Tours: editable title/body text for every step of every
 * guided-tour walkthrough, plus each tour's trigger label — same
 * fetch/edit/save shape as the Tooltips panel on Site CMS. Which DOM
 * element a step points at (and step order) stays defined in code
 * (apps/web/src/components/tour/tour-definitions.ts); this page only owns
 * the words.
 */
export default function AdminToursPage() {
  const [tours, setTours] = useState<TourData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tours")
      .then((res) => res.json())
      .then((data) => {
        const list: TourData[] = data.tours ?? [];
        setTours(list);
        setActiveTourId((prev) => prev ?? list[0]?.tourId ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateLabel(tourId: string, tourLabel: string) {
    setTours((prev) => prev.map((t) => (t.tourId !== tourId ? t : { ...t, tourLabel })));
  }

  function updateStep(tourId: string, stepKey: string, field: "title" | "body", value: string) {
    setTours((prev) =>
      prev.map((t) =>
        t.tourId !== tourId
          ? t
          : { ...t, steps: t.steps.map((s) => (s.key !== stepKey ? s : { ...s, [field]: value })) }
      )
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
      <h1>Guided Tours</h1>
      <p className="subtitle">
        The spotlight walkthroughs shown on Business and Parent Org dashboards (never Admin). Each tour below lists
        its steps in the order they play.
      </p>
      {savedMsg && <p style={{ color: "var(--accent, #127C57)", fontSize: 13, margin: "10px 0" }}>{savedMsg}</p>}

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
