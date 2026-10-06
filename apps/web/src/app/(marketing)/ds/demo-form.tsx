"use client";

import { useState, type FormEvent } from "react";

type Labels = Record<string, string | undefined>;

/** The inline "Book a demo" form on the Company page. Same endpoint as the modal; every label is Site Content. */
export function DemoForm({ labels, options }: { labels: Labels; options: string[] }) {
  const L = (key: string, fallback: string) => labels[key] || fallback;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState(options[0] ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body = [labels.demoProductLabel && product ? `${labels.demoProductLabel}: ${product}` : "", message].filter(Boolean).join("\n\n");
    const res = await fetch("/api/demo-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, company, message: body }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? L("demoError", "Something went wrong — try again."));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="ds-demo-form">
        <div className="ds-ok">
          <b>{L("demoSuccessTitle", "Thanks — we’ll be in touch.")}</b>
          <br />
          {L("demoSuccessBody", "Someone from our team will reach out at {email} to set up a time.").replace("{email}", email)}
        </div>
      </div>
    );
  }

  return (
    <form className="ds-demo-form" onSubmit={submit}>
      <div className="ds-two">
        <label htmlFor="df-name">
          {L("demoLabelName", "Name")}
          <input id="df-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label htmlFor="df-email">
          {L("demoLabelEmail", "Work email")}
          <input id="df-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      </div>
      <div className="ds-two">
        <label htmlFor="df-company">
          {L("demoLabelCompany", "Company")}
          <input id="df-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        {options.length > 0 && (
          <label htmlFor="df-product">
            {labels.demoProductLabel}
            <select id="df-product" value={product} onChange={(e) => setProduct(e.target.value)}>
              {options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label htmlFor="df-message">
        {L("demoLabelMessage", "What would you like to see?")}
        <textarea id="df-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {error && <p className="ds-form-error">{error}</p>}
      <button className="ds-btn ds-btn-p" type="submit" disabled={submitting} style={{ justifySelf: "start" }}>
        {submitting ? L("demoSubmitting", "Sending…") : L("demoSubmit", "Request a demo")}
      </button>
    </form>
  );
}
