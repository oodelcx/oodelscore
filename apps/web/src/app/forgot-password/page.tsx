"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import "../admin/admin.css";
import "../auth.css";
import { AuthShell } from "@/components/auth-shell";

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
    <AuthShell>
      <div className="auth-brand">Reset your password</div>
      <p className="auth-subtitle">We&rsquo;ll email you a link to set a new one.</p>
      {submitted ? (
        <p className="auth-success">If an account exists for that email, we&apos;ve sent a reset link.</p>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
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
    </AuthShell>
  );
}
