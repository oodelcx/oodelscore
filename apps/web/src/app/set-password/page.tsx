"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../admin/admin.css";
import "../auth.css";

/** Completes either flow that hands out a set-password link (spec Section
 * 11): the initial invite, or a password reset — both land here with
 * ?uid=&token= and both call the same /api/auth/set-password route. */
function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Something went wrong");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (!uid || !token) {
    return <p className="auth-success">This link is missing its invite/reset details. Ask an admin to resend it.</p>;
  }

  if (success) {
    return <p className="auth-success">Password set — redirecting to sign in…</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>New password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
      </div>
      <div className="field">
        <label>Confirm password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn btn-dark" disabled={loading}>
        {loading ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Oodel Score</div>
        <p className="auth-subtitle">Set your password.</p>
        <Suspense fallback={<p className="auth-success">Loading…</p>}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
