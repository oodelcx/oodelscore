"use client";

import { useEffect, useState } from "react";

interface AnswerRow {
  type: string;
  value: unknown;
}
interface ResponseRow {
  _id: string;
  answers: AnswerRow[];
  submittedAt: string;
}

export default function RawFeedbackPage() {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/responses")
      .then((res) => res.json())
      .then((data) => setResponses(data.responses ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Raw Feedback</h1>
          <p className="subtitle">Every response submitted through your feedback points.</p>
        </div>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Answers</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r._id}>
                <td>{new Date(r.submittedAt).toLocaleString()}</td>
                <td>{r.answers.map((a) => `${a.type}: ${String(a.value)}`).join(" · ")}</td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={2} className="subtitle">
                  No feedback yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
