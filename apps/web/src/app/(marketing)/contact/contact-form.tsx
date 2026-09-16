"use client";

import { useRef, useState, type FormEvent } from "react";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ContactForm({ successHeadline, successBody }: { successHeadline: string; successBody: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  // Bot mitigation, no visible challenge — see apps/web/src/app/api/contact/route.ts
  // for the full rationale. `website` is a honeypot real visitors never see
  // or fill (styled off-screen via .contact-form-honeypot in marketing.css);
  // `formMountedAt` timestamps when the form appeared so the server can
  // reject submissions that arrive implausibly fast for a human to have
  // typed into four fields.
  const [website, setWebsite] = useState("");
  const formMountedAt = useRef(Date.now());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function validate(): string | null {
    if (!name.trim()) return "Name is required.";
    if (!email.trim() || !isValidEmail(email.trim())) return "A valid email is required.";
    if (!message.trim()) return "Message is required.";
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, company, message, website, formStartedAt: formMountedAt.current }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Something went wrong — try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="contact-form-success">
        <h3>{successHeadline}</h3>
        <p>{successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="demo-field">
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="demo-field">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="demo-field">
        <label>Company (optional)</label>
        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="demo-field">
        <label>Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required />
      </div>

      {/* Honeypot — real users never see this field (off-screen, not part
          of the tab order); a bot filling every input on the page fills
          it too, which the server treats as a silent reject. */}
      <div className="contact-form-honeypot" aria-hidden="true">
        <label htmlFor="contact_company_url">Company URL</label>
        <input
          id="contact_company_url"
          type="text"
          name="company_url"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && <p className="demo-modal-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={submitting} style={{ width: "100%", border: "none" }}>
        {submitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
