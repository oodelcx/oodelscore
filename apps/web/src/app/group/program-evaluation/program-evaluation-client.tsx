"use client";

import { useEffect, useState } from "react";
import { ProgramEvaluationList, type ProgramEvaluationItem } from "@/components/program-evaluation-list";

export default function GroupProgramEvaluationClient() {
  const [items, setItems] = useState<ProgramEvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/group/program-evaluation")
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

  async function rerun(eventId: string) {
    await fetch(`/api/group/program-evaluation/${eventId}/rerun`, { method: "POST" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Program Evaluation</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>
            Training evaluations across your branches. Program details (synopsis/objectives) are entered by each
            branch; you can view results and re-run an evaluation here.
          </p>
        </div>
      </div>
      {error && <p style={{ color: "var(--red, #b3261e)" }}>{error}</p>}
      {!error && loading && <p className="subtitle">Loading…</p>}
      {!error && !loading && (
        <ProgramEvaluationList
          items={items}
          showBranch={true}
          allowEditDetails={false}
          onSaveDetails={async () => {}}
          onRerun={rerun}
        />
      )}
    </div>
  );
}
