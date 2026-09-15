"use client";

import { useState } from "react";

interface TriggerStatus {
  isTriggered: boolean;
  currentValue: number | null;
  description: string;
}
interface Run {
  _id: string;
  steps: string[];
  completedStepIndexes: number[];
  status: "active" | "completed" | "abandoned";
}

/**
 * Shared by Business and Group Playbooks — the "operational guidance, not
 * just a document" piece of the CX intelligence roadmap. Shows whether the
 * structured trigger condition is currently met, and turns `steps` from a
 * static bullet list into a real, trackable checklist once someone starts
 * a run.
 */
export function PlaybookRunPanel({
  triggerStatus,
  activeRun,
  startPath,
  runsPath,
  onChange,
}: {
  triggerStatus: TriggerStatus | null;
  activeRun: Run | null;
  startPath: string; // e.g. /api/business/playbooks/:id/start (id already substituted)
  runsPath: string; // e.g. /api/business/playbook-runs
  onChange: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  async function start() {
    setStarting(true);
    await fetch(startPath, { method: "POST" });
    setStarting(false);
    onChange();
  }

  async function toggleStep(run: Run, index: number, completed: boolean) {
    setToggling(index);
    await fetch(`${runsPath}/${run._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: index, completed }),
    });
    setToggling(null);
    onChange();
  }

  async function abandon(run: Run) {
    if (!confirm("Abandon this run? Progress will be lost.")) return;
    await fetch(`${runsPath}/${run._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "abandoned" }),
    });
    onChange();
  }

  return (
    <div style={{ marginTop: 10 }}>
      {triggerStatus && (
        <div className="metric-note" style={{ marginBottom: 8 }}>
          <span className={`pill ${triggerStatus.isTriggered ? "pill-red" : "pill-green"}`} style={{ marginRight: 6 }}>
            {triggerStatus.isTriggered ? "Triggered now" : "Not triggered"}
          </span>
          {triggerStatus.description}
        </div>
      )}

      {!activeRun && (
        <button className="btn btn-sm" disabled={starting} onClick={start}>
          {starting ? "Starting…" : "Start playbook"}
        </button>
      )}

      {activeRun && (
        <div style={{ marginTop: 6 }}>
          <div className="subtitle" style={{ marginBottom: 6 }}>
            {activeRun.completedStepIndexes.length} of {activeRun.steps.length} steps done
          </div>
          {activeRun.steps.map((step, i) => {
            const checked = activeRun.completedStepIndexes.includes(i);
            return (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={toggling === i}
                  onChange={(e) => toggleStep(activeRun, i, e.target.checked)}
                />
                <span style={{ textDecoration: checked ? "line-through" : "none", color: checked ? "var(--text-3)" : "inherit" }}>{step}</span>
              </label>
            );
          })}
          <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => abandon(activeRun)}>
            Abandon run
          </button>
        </div>
      )}
    </div>
  );
}
