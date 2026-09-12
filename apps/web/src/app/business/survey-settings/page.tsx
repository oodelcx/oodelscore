"use client";

import { useEffect, useState } from "react";

interface SettingsData {
  demographicConfig: Record<string, string>;
  typesInUse: string[];
}

const DEMOGRAPHIC_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  ageGroup: "Age group",
  gender: "Gender",
};
const QUESTION_TYPE_LABELS: Record<string, string> = {
  star_1_5: "Star rating",
  nps_0_10: "NPS (0–10)",
  yes_no: "Yes / no",
  open_text: "Open-ended comments",
  emoji_scale: "Emoji scale",
  multiple_choice: "Multiple choice",
  multi_select: "Multi-select",
  slider: "Slider",
  dropdown: "Dropdown",
};

function modePill(mode: string) {
  if (mode === "mandatory") return <span className="pill pill-green">Mandatory</span>;
  if (mode === "optional") return <span className="pill pill-amber">Optional</span>;
  return <span className="pill pill-gray">Off</span>;
}

export default function SurveySettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/survey-settings")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="subtitle">Loading…</p>;
  if (!data) return <p className="error-text">Couldn&apos;t load survey settings.</p>;

  return (
    <div>
      <h1>Survey settings</h1>
      <p className="subtitle">What we ask your customers, and how. Configured with your account manager.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Respondent details</h3>
        <p className="card-sub">Whether each field is off, optional, or required.</p>
        {Object.entries(DEMOGRAPHIC_LABELS).map(([key, label]) => (
          <div className="config-row" key={key}>
            <div className="config-label">{label}</div>
            {modePill(data.demographicConfig[key] ?? "off")}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Question types in use</h3>
        <p className="card-sub">Across your feedback points.</p>
        {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => (
          <div className="config-row" key={type}>
            <div className="config-label">{label}</div>
            <span className={`pill ${data.typesInUse.includes(type) ? "pill-accent" : "pill-gray"}`}>
              {data.typesInUse.includes(type) ? "Active" : "Not in use"}
            </span>
          </div>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 16 }}>
        Message us to change these →
      </button>
    </div>
  );
}
