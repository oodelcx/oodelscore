"use client";

import { useState } from "react";

const CONFIRM_PHRASE = "DELETE ALL DATA";

export default function DevDataToolsPage() {
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<Record<string, number> | null>(null);
  const [insightsResult, setInsightsResult] = useState<{ reportsCreated: number; reportsSkipped: number } | null>(null);

  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedDemoError, setSeedDemoError] = useState<string | null>(null);
  const [seedDemoResult, setSeedDemoResult] = useState<readonly { email: string; label: string }[] | null>(null);

  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeResult, setWipeResult] = useState<Record<string, number> | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");

  async function runSeed() {
    if (
      !confirm(
        "This creates a full showcase dataset (a bank, a telecom, a school trust, a non-profit, an airline, a restaurant, and a hospital network) with sample feedback, alerts, cases, billing, and more, then generates live AI Insight Reports via the Claude API. Every login it creates uses password \"ocx123\". Continue?"
      )
    ) {
      return;
    }
    setSeeding(true);
    setSeedError(null);
    setSeedResult(null);
    setInsightsResult(null);
    const res = await fetch("/api/admin/dev-tools/seed-showcase", { method: "POST" });
    const data = await res.json().catch(() => null);
    setSeeding(false);
    if (!res.ok) {
      setSeedError(data?.message ?? "Failed to seed showcase data");
      return;
    }
    setSeedResult(data.result);
    setInsightsResult(data.insights ?? null);
  }

  async function runSeedDemo() {
    setSeedingDemo(true);
    setSeedDemoError(null);
    setSeedDemoResult(null);
    const res = await fetch("/api/admin/dev-tools/seed-demo", { method: "POST" });
    const data = await res.json().catch(() => null);
    setSeedingDemo(false);
    if (!res.ok) {
      setSeedDemoError(data?.message ?? "Failed to seed demo accounts");
      return;
    }
    setSeedDemoResult(data.accounts);
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
          flows, spanning every product combination and account shape the app supports: <b>Meridian Bank
          Group</b> (bank, 4 branches, Customer Experience + Colleague Experience), <b>Skyline Telecom</b> (3
          branches, Colleague Experience only), <b>Horizon Schools Trust</b> (10 schools, Customer Experience
          only), <b>Amani Women&apos;s Empowerment &amp; Peacebuilding Institute</b> (non-profit, standalone,
          events-based training sessions), <b>Aurora Airlines</b> (3 hubs, Colleague Experience only), <b>The
          Olive Table</b> (restaurant, standalone), and <b>St. Augustine Health Network</b> (hospital, 3
          branches, both products). Every business gets a question template, feedback points, weeks of real
          feedback responses (some negative), alert rules, auto-created cases with comments and resolutions,
          support tickets, and a CX Goal; each of the seven organizations additionally gets one full case
          journey — a recurring-issue flag, an improvement initiative, a decision log entry with a measured
          before/after outcome, and a linked playbook run — plus billing in different states (active, overdue,
          comp), category owner mappings, and CX Pulse scores computed from all of it. Finishes by generating
          AI Insight Reports for every owner across every cadence live via the Claude API against this real
          data (falls back to a deterministic narrative if no Anthropic key is configured).
        </p>
        <p className="card-sub">
          Every login this creates — business owners, group owners, team members — uses the password{" "}
          <code>ocx123</code>. No real email is ever sent by this tool.
        </p>
        {seedError && <p className="error-text">{seedError}</p>}
        <button className="btn btn-dark" disabled={seeding} onClick={runSeed}>
          {seeding ? "Seeding… this can take a few minutes" : "Seed showcase data"}
        </button>
        {seedResult && (
          <div className="callout" style={{ marginTop: 12 }}>
            Done. {seedResult.parentOrgs} organizations, {seedResult.businesses} businesses, {seedResult.users} logins,{" "}
            {seedResult.responses} feedback responses, {seedResult.actionBoardItems} cases,{" "}
            {seedResult.alertRules} alert rules, {seedResult.billingSubscriptions} billing subscriptions created.
            {insightsResult && ` ${insightsResult.reportsCreated} AI Insight Reports generated (${insightsResult.reportsSkipped} skipped — already existed or nothing to report).`}
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <h3>Seed the 4 documented demo logins</h3>
        <p className="card-sub">
          Ensures one login per account type — Admin, Group owner, standalone Business owner, Business-as-branch
          owner — exists with a working password, using the fixed emails/passwords documented in the repo
          (<code>demoAccounts.ts</code>). Idempotent: safe to run again if any of the four are missing or broken.
          Use this instead of Seed showcase data when you just need one known login per role, not a full dataset.
        </p>
        {seedDemoError && <p className="error-text">{seedDemoError}</p>}
        <button className="btn btn-dark" disabled={seedingDemo} onClick={runSeedDemo}>
          {seedingDemo ? "Seeding…" : "Seed demo accounts"}
        </button>
        {seedDemoResult && (
          <div className="callout" style={{ marginTop: 12 }}>
            Ready: {seedDemoResult.map((a) => `${a.label} (${a.email})`).join(", ")}.
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 720, borderColor: "var(--red, crimson)" }}>
        <h3 style={{ color: "var(--red, crimson)" }}>Wipe all data</h3>
        <p className="card-sub">
          Deletes every business, parent organization, login (other than Admin staff), feedback response, alert,
          case, playbook, decision, category, question template, and billing record — everything
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
