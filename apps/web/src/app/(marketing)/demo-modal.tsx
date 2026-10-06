"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode, type FormEvent } from "react";

interface DemoModalContextValue {
  open: () => void;
}

const DemoModalContext = createContext<DemoModalContextValue | null>(null);

export function useDemoModal(): DemoModalContextValue {
  const ctx = useContext(DemoModalContext);
  if (!ctx) throw new Error("useDemoModal must be used within DemoModalProvider");
  return ctx;
}

export function BookDemoButton({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { open } = useDemoModal();
  return (
    <button type="button" className={className} style={style} onClick={open}>
      {children}
    </button>
  );
}

export function DemoModalProvider({ children, labels }: { children: ReactNode; labels?: Record<string, string | undefined> }) {
  const L = (key: string, fallback: string) => labels?.[key] || fallback;
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function close() {
    setIsOpen(false);
    setError(null);
    if (submitted) {
      setSubmitted(false);
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/demo-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, company, message }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? L("demoError", "Something went wrong — try again."));
      return;
    }
    setSubmitted(true);
  }

  return (
    <DemoModalContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      {isOpen && (
        <div className="demo-modal-overlay" onClick={close}>
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="demo-modal-close" onClick={close} aria-label="Close">
              ✕
            </button>
            {submitted ? (
              <div className="demo-modal-success">
                <h3>{L("demoSuccessTitle", "Thanks — we’ll be in touch.")}</h3>
                <p>{L("demoSuccessBody", "Someone from our team will reach out at {email} to set up a time.").replace("{email}", email)}</p>
              </div>
            ) : (
              <>
                <h3>{L("demoTitle", "Book a demo")}</h3>
                <p className="demo-modal-sub">{L("demoSub", "Twenty minutes, a live walkthrough of real workflows — not a canned script.")}</p>
                <form onSubmit={handleSubmit}>
                  <div className="demo-field">
                    <label>{L("demoLabelName", "Name")}</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                  </div>
                  <div className="demo-field">
                    <label>{L("demoLabelEmail", "Work email")}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="demo-field">
                    <label>{L("demoLabelCompany", "Company")}</label>
                    <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                  <div className="demo-field">
                    <label>{L("demoLabelMessage", "What would you like to see?")}</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                  </div>
                  {error && <p className="demo-modal-error">{error}</p>}
                  <button type="submit" className="btn-primary" disabled={submitting} style={{ width: "100%", border: "none" }}>
                    {submitting ? L("demoSubmitting", "Sending…") : L("demoSubmit", "Request a demo")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </DemoModalContext.Provider>
  );
}
