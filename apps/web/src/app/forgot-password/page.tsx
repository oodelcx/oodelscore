"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import "../admin/admin.css";
import "../auth.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Oodel Score</div>
        <p className="auth-subtitle">Reset your password.</p>
        {submitted ? (
          <p className="auth-success">If an account exists for that email, we&apos;ve sent a reset link.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <button type="submit" className="btn btn-dark" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <div className="auth-footer">
          <Link href="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
