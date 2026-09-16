"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordField } from "@/components/password-field";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(data?.message ?? "Login failed");
      return;
    }

    if (data?.status === "2fa_required") {
      setPendingToken(data.pendingToken);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/2fa/login-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingToken, code }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "Verification failed");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (pendingToken) {
    return (
      <>
        <div className="auth-brand">Two-factor verification</div>
        <p className="auth-subtitle">Enter the 6-digit code from your authenticator app.</p>
        <form className="auth-form" onSubmit={handleVerifyCode}>
          <div className="field">
            <label>Verification code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-dark" disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
        <div className="auth-footer">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPendingToken(null);
              setCode("");
              setError(null);
            }}
          >
            Back to sign in
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="auth-brand">Sign in</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-dark" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="auth-footer">
        <Link href="/forgot-password">Forgot password?</Link>
      </div>
    </>
  );
}
