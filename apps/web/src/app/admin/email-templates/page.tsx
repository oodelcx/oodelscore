"use client";

import { useEffect, useState } from "react";
import type { EmailTemplateKey } from "@oodelscore/shared";

interface TemplateDoc {
  key: EmailTemplateKey;
  subject: string;
  body: string;
  availableVars: string[];
  lastEditedAt: string | null;
}

const TRIGGER_COPY: Record<EmailTemplateKey, { label: string; trigger: string }> = {
  welcome: { label: "Welcome", trigger: "Admin creates a business, org, or staff account" },
  email_changed: { label: "Email Changed", trigger: "User's login email is updated" },
  password_reset: { label: "Password Reset", trigger: "User requests a reset link" },
  invite_to_team: { label: "Invite to Team", trigger: "Someone invites a staff or org member" },
  alert_notification: { label: "Alert Notification", trigger: "An Alert Rule fires on a business" },
  report_ready: { label: "Report Ready", trigger: "An AI Insights report is approved" },
  action_assigned: { label: "Action Assigned", trigger: "Someone is assigned an item on a group's Action Board" },
  invoice_receipt: { label: "Invoice Receipt", trigger: "A payment succeeds" },
  payment_failed: { label: "Payment Failed", trigger: "A payment fails or goes overdue" },
  demo_request: { label: "Demo Request", trigger: "A visitor submits \"Book a demo\" on the marketing site" },
  feedback_point_request: {
    label: "Feedback Point Request",
    trigger: "A business requests a new feedback point or changes to one",
  },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "Today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

// Fills merge vars with example data for the live preview, same purpose as
// the mockup's static preview but driven by whatever vars this template
// actually declares.
function renderPreview(text: string, availableVars: string[]): string {
  const examples: Record<string, string> = {
    name: "Amara",
    email: "amara@meridianretail.com",
    inviter_name: "Jordan",
    business_name: "Meridian Retail",
    set_password_link: "https://oodelscore.com/set-password/…",
    reset_link: "https://oodelscore.com/reset/…",
    alert_condition: "Avg score dropped below 3.0",
    alert_link: "https://oodelscore.com/business/alert-rules",
    report_period: "August",
    report_link: "https://oodelscore.com/business/insights",
    action_title: "Follow up with kitchen team",
    due_date: "Sep 20",
    action_link: "https://oodelscore.com/group/action-board",
    invoice_amount: "£249.00",
    billing_link: "https://oodelscore.com/business/billing",
    requester_name: "Priya Shah",
    requester_email: "priya@northgateretail.com",
    requester_company: "Northgate Retail",
    requester_message: "We run 40 locations and want to see the Group dashboard.",
  };
  let out = text;
  for (const v of availableVars) {
    out = out.split(`{{${v}}}`).join(examples[v] ?? `{{${v}}}`);
  }
  return out;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<EmailTemplateKey | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/email-templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const editing = templates.find((t) => t.key === editingKey) ?? null;

  function openEditor(t: TemplateDoc) {
    setEditingKey(t.key);
    setSubject(t.subject);
    setBodyText(t.body);
    setSavedMsg(null);
  }

  function insertVar(v: string) {
    setBodyText((prev) => `${prev}{{${v}}}`);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setSavedMsg(null);
    const res = await fetch(`/api/admin/email-templates/${editing.key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body: bodyText }),
    });
    setSaving(false);
    if (res.ok) {
      setSavedMsg("Saved — live via Resend");
      load();
    }
  }

  if (editing) {
    const copy = TRIGGER_COPY[editing.key];
    return (
      <div>
        <span className="backlink" onClick={() => setEditingKey(null)}>
          ← Back to Email Templates
        </span>
        <div className="page-head">
          <div>
            <h1>{copy.label}</h1>
            <p className="subtitle" style={{ margin: 0 }}>
              {copy.trigger}
            </p>
          </div>
          <div className="btn-group">
            <button className="btn" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {savedMsg && <p style={{ color: "var(--accent, #127C57)", fontSize: 13 }}>{savedMsg}</p>}

        <div className="editor-grid">
          <div>
            <div className="field">
              <label>Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="field">
              <label>Body</label>
              <textarea style={{ minHeight: 180 }} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
            </div>
            <div className="field">
              <label>Merge variables — click to insert</label>
              {editing.availableVars.map((v) => (
                <span key={v} className="var-chip" onClick={() => insertVar(v)}>
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
          <div className="preview-pane">
            <div className="preview-toolbar">Live preview · rendered with example data</div>
            <div className="preview-body">
              <div className="p-from">From: Oodel Score &lt;hello@oodelscore.com&gt;</div>
              <div className="p-subject">{renderPreview(subject, editing.availableVars)}</div>
              <div className="p-text" style={{ whiteSpace: "pre-wrap" }}>
                {renderPreview(bodyText, editing.availableVars)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Email Templates</h1>
      <p className="subtitle">
        Sent live via Resend. Respondents who fill out a feedback form never receive an email — these are account-side only.
      </p>

      {loading ? (
        <p className="subtitle">Loading…</p>
      ) : (
        <table className="clean">
          <thead>
            <tr>
              <th>Template</th>
              <th>Triggered by</th>
              <th>Last edited</th>
              <th>Delivery</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const copy = TRIGGER_COPY[t.key];
              return (
                <tr key={t.key}>
                  <td>{copy?.label ?? t.key}</td>
                  <td>{copy?.trigger}</td>
                  <td>{timeAgo(t.lastEditedAt)}</td>
                  <td>
                    <span className="pill pill-resend">Resend</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="btn btn-sm" onClick={() => openEditor(t)}>
                      Edit →
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
