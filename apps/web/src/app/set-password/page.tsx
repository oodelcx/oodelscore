"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    return <p>This link is missing its invite/reset details. Ask an admin to resend it.</p>;
  }

  if (success) {
    return <p>Password set — redirecting to sign in…</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={{ display: "block", marginBottom: 12 }}>
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        Confirm password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Set your password</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <SetPasswordForm />
      </Suspense>
    </main>
  );
}
