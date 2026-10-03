"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordField } from "@/components/password-field";

/** Completes either flow that hands out a set-password link (spec Section
 * 11): the initial invite, or a password reset — both land here with
 * ?uid=&token= and both call the same /api/auth/set-password route. */
function SetPasswordFields() {
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
      // "Invalid or expired link" means retrying this same link can never
      // succeed — show the same actionable next step as the missing-params
      // case below instead of leaving a form up that will just fail again.
      setError(data?.message === "Invalid or expired link" ? "expired" : (data?.message ?? "Something went wrong"));
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (!uid || !token) {
    return <p className="auth-success">This link is missing its invite/reset details. Ask an admin to resend it.</p>;
  }

  if (error === "expired") {
    return <p className="auth-success">This link has expired. Ask an admin to resend it.</p>;
  }

  if (success) {
    return <p className="auth-success">Password set — redirecting to sign in…</p>;
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field">
        <label>New password</label>
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
      </div>
      <div className="field">
        <label>Confirm password</label>
        <PasswordField value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn btn-dark" disabled={loading}>
        {loading ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}

export function SetPasswordForm() {
  return (
    <>
      <div className="auth-brand">Set your password</div>
      <p className="auth-subtitle">Choose a password to finish setting up your account.</p>
      <Suspense fallback={<p className="auth-success">Loading…</p>}>
        <SetPasswordFields />
      </Suspense>
    </>
  );
}
