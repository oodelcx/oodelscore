"use client";

import { useEffect, useState } from "react";
import { ProgramEvaluationList, type ProgramEvaluationItem } from "@/components/program-evaluation-list";

export default function BusinessProgramEvaluationClient() {
  const [items, setItems] = useState<ProgramEvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/business/program-evaluation")
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setError(data.message ?? "Unable to load Program Evaluation.");
          return;
        }
        setItems(data.items ?? []);
      })
      .catch(() => setError("Unable to load Program Evaluation."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveDetails(eventId: string, details: { synopsis: string; objectives: string[]; expectedOutcomes: string[] }) {
    await fetch(`/api/business/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    load();
  }

  async function rerun(eventId: string) {
    await fetch(`/api/business/program-evaluation/${eventId}/rerun`, { method: "POST" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Program Evaluation</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>
            For a training/program Event: set what it was meant to achieve, and get an AI evaluation of the feedback
            against those objectives once enough responses are in.
          </p>
        </div>
      </div>
      {error && <p style={{ color: "var(--red, #b3261e)" }}>{error}</p>}
      {!error && loading && <p className="subtitle">Loading…</p>}
      {!error && !loading && <ProgramEvaluationList items={items} showBranch={false} onSaveDetails={saveDetails} onRerun={rerun} />}
    </div>
  );
}
