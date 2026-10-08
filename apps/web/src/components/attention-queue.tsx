"use client";

import { useEffect, useMemo, useState } from "react";

interface Item {
  _id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  currentEscalationLevel: number;
  originatorLabel?: string;
}

const DAY = 24 * 60 * 60 * 1000;

function describe(item: Item, now: number) {
  const due = item.dueDate ? new Date(item.dueDate).getTime() : null;
  const days = due === null ? null : Math.ceil((due - now) / DAY);
  const overdue = days !== null && days < 0;
  const severity: "high" | "med" | "low" = overdue || item.priority === "high" ? "high" : item.priority === "medium" ? "med" : "low";
  let pill = { cls: "pill-gray", text: "No due date" };
  if (days !== null) {
    pill = overdue
      ? { cls: "pill-red", text: `Overdue ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}` }
      : days === 0
        ? { cls: "pill-amber", text: "Due today" }
        : { cls: days <= 3 ? "pill-amber" : "pill-green", text: `Due in ${days} day${days === 1 ? "" : "s"}` };
  }
  return { overdue, severity, pill };
}

/**
 * The first thing on the Overview: the open cases that need a person, worst
 * first, each one opening its full case trail. Shared by the Business and
 * Group portals.
 */
export function AttentionQueue({ portal }: { portal: "business" | "group" }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<"all" | "urgent" | "escalated">("all");

  useEffect(() => {
    fetch(`/api/${portal}/action-board`)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]));
  }, [portal]);

  const now = Date.now();
  const open = useMemo(() => (items ?? []).filter((i) => i.status !== "resolved"), [items]);
  const decorated = useMemo(
    () =>
      open
        .map((i) => ({ i, d: describe(i, now) }))
        .sort((a, b) => Number(b.d.overdue) - Number(a.d.overdue) || ["high", "med", "low"].indexOf(a.d.severity) - ["high", "med", "low"].indexOf(b.d.severity)),
    [open, now]
  );
  const urgent = decorated.filter((x) => x.d.severity === "high");
  const escalated = decorated.filter((x) => x.i.currentEscalationLevel > 1);
  const shown = (filter === "urgent" ? urgent : filter === "escalated" ? escalated : decorated).slice(0, 6);

  // Hold the space while loading so the cards below don't jump down when the list arrives.
  if (items === null) {
    return <section className="card queue" style={{ marginBottom: 20, minHeight: 330 }} aria-busy="true" aria-label="Loading cases" />;
  }
  return (
    <section className="card queue" style={{ marginBottom: 20 }} aria-labelledby="attn-h">
      <div className="queue-head">
        <h3 id="attn-h">Needs your attention</h3>
        <div className="filters" style={{ margin: 0 }} role="group" aria-label="Filter cases">
          <button className={`chip${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
            All {decorated.length}
          </button>
          <button className={`chip${filter === "urgent" ? " active" : ""}`} onClick={() => setFilter("urgent")}>
            Urgent {urgent.length}
          </button>
          <button className={`chip${filter === "escalated" ? " active" : ""}`} onClick={() => setFilter("escalated")}>
            Escalated {escalated.length}
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="queue-empty">Nothing here. Every case in this view is handled.</div>
      ) : (
        shown.map(({ i, d }) => (
          <a key={i._id} className="queue-row" href={`/${portal}/cases/${i._id}`}>
            <span className={`stripe ${d.severity}`} />
            <div>
              <b>{i.title}</b>
              <div className="queue-meta">
                <span>{i.status.replace(/_/g, " ")}</span>
                <span>Level {i.currentEscalationLevel}</span>
                {i.originatorLabel && <span>Raised by {i.originatorLabel}</span>}
              </div>
            </div>
            <div className="right">
              <span className={`pill ${d.pill.cls}`}>{d.pill.text}</span>
              <span className="go">Open →</span>
            </div>
          </a>
        ))
      )}
      <div className="queue-head" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, padding: "10px 18px" }}>
        <span className="small" style={{ color: "var(--text-3)", fontSize: 12.5 }}>
          Showing {shown.length} of {open.length} open case{open.length === 1 ? "" : "s"}
        </span>
        <a href={`/${portal}/cases`} style={{ fontSize: 12.5, fontWeight: 600 }}>
          Open Case Management →
        </a>
      </div>
    </section>
  );
}
