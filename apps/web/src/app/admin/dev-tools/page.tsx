"use client";

import { useState } from "react";

const CONFIRM_PHRASE = "DELETE ALL DATA";

export default function DevDataToolsPage() {
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<Record<string, number> | null>(null);

  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeResult, setWipeResult] = useState<Record<string, number> | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");

  async function runSeed() {
    if (
      !confirm(
        "This creates a full showcase dataset (banks, schools, a diagnostics lab, a retail chain, and standalone businesses) with sample feedback, alerts, action items, billing, and more. Every login it creates uses password \"ocx123\". Continue?"
      )
    ) {
      return;
    }
    setSeeding(true);
    setSeedError(null);
    setSeedResult(null);
    const res = await fetch("/api/admin/dev-tools/seed-showcase", { method: "POST" });
    const data = await res.json().catch(() => null);
    setSeeding(false);
    if (!res.ok) {
      setSeedError(data?.message ?? "Failed to seed showcase data");
      return;
    }
    setSeedResult(data.result);
  }

  async function runWipe() {
    if (wipeConfirmText !== CONFIRM_PHRASE) return;
    setWiping(true);
    setWipeError(null);
    setWipeResult(null);
    const res = await fetch("/api/admin/dev-tools/wipe-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: wipeConfirmText }),
    });
    const data = await res.json().catch(() => null);
    setWiping(false);
    if (!res.ok) {
      setWipeError(data?.message ?? "Failed to wipe data");
      return;
    }
    setWipeResult(data.counts);
    setShowWipeConfirm(false);
    setWipeConfirmText("");
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dev Data Tools</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Only visible here because this environment has Dev Data Tools enabled — never turn this on for a
            production deployment.
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <h3>Seed showcase data</h3>
        <p className="card-sub">
          Creates a realistic, connected dataset so you can click through every page and see how data actually
          flows: <b>Meridian Bank Group</b> (3 branches), <b>Bright Future Schools Trust</b> (3 schools, one billed
          separately from the group), <b>PrecisionDx Diagnostics</b> (3 locations, comp account), <b>UrbanMart
          Retail</b> (3 stores) — plus four standalone businesses across restaurant, fitness, and automotive.
          Every business gets a question template, a feedback point, weeks of real feedback responses (some
          negative), alert rules, auto-created Action Board items with comments and resolutions, playbooks,
          category owner mappings, billing in different states (active, overdue, comp), and CX Pulse scores
          computed from all of it. Also seeds sample AI Insights reports — weekly, monthly, quarterly, and
          yearly, both approved (visible on Business/Group Insights tabs) and pending or rejected (visible in
          the Admin AI Insights Queue) — so you can preview the feature before the real generation pipeline runs.
        </p>
        <p className="card-sub">
          Every login this creates — business owners, group owners, team members — uses the password{" "}
          <code>ocx123</code>. No real email is ever sent by this tool.
        </p>
        {seedError && <p className="error-text">{seedError}</p>}
        <button className="btn btn-dark" disabled={seeding} onClick={runSeed}>
          {seeding ? "Seeding… this can take a minute" : "Seed showcase data"}
        </button>
        {seedResult && (
          <div className="callout" style={{ marginTop: 12 }}>
            Done. {seedResult.parentOrgs} organizations, {seedResult.businesses} businesses, {seedResult.users} logins,{" "}
            {seedResult.responses} feedback responses, {seedResult.actionBoardItems} Action Board items,{" "}
            {seedResult.alertRules} alert rules, {seedResult.billingSubscriptions} billing subscriptions created.
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 720, borderColor: "var(--red, crimson)" }}>
        <h3 style={{ color: "var(--red, crimson)" }}>Wipe all data</h3>
        <p className="card-sub">
          Deletes every business, parent organization, login (other than Admin staff), feedback response, alert,
          Action Board item, playbook, decision, category, question template, and billing record — everything
          except staff logins and platform configuration (roles, email templates, site content). This cannot be
          undone. Use this once you're done exploring the showcase and are ready to enter real data.
        </p>
        {wipeError && <p className="error-text">{wipeError}</p>}
        {!showWipeConfirm ? (
          <button className="btn" style={{ borderColor: "var(--red, crimson)", color: "var(--red, crimson)" }} onClick={() => setShowWipeConfirm(true)}>
            Wipe all data…
          </button>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div className="field">
              <label>
                Type <code>{CONFIRM_PHRASE}</code> to confirm
              </label>
              <input type="text" value={wipeConfirmText} onChange={(e) => setWipeConfirmText(e.target.value)} autoFocus />
            </div>
            <button
              className="btn btn-dark"
              style={{ background: "var(--red, crimson)", borderColor: "var(--red, crimson)" }}
              disabled={wiping || wipeConfirmText !== CONFIRM_PHRASE}
              onClick={runWipe}
            >
              {wiping ? "Wiping…" : "Permanently delete everything"}
            </button>{" "}
            <button className="btn" disabled={wiping} onClick={() => { setShowWipeConfirm(false); setWipeConfirmText(""); }}>
              Cancel
            </button>
          </div>
        )}
        {wipeResult && (
          <div className="callout" style={{ marginTop: 12 }}>
            Wiped: {Object.entries(wipeResult).map(([k, v]) => `${k} (${v})`).join(", ")}.
          </div>
        )}
      </div>
    </div>
  );
}
