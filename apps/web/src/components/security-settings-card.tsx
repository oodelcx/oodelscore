"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Change-password card, shared across Business, Group, and Admin — same
 * flow (verify current password, then update) regardless of account type. */
function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to change password");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Change password</h3>
      <p className="card-sub">Update the password you use to sign in.</p>

      <div className="field" style={{ marginTop: 10 }}>
        <label>Current password</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>New password</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Confirm new password</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && (
        <p className="callout" style={{ marginTop: 10 }}>
          <span className="pill pill-green" style={{ marginRight: 8 }}>
            Updated
          </span>
          Your password has been changed.
        </p>
      )}

      <button
        className="btn btn-dark btn-sm"
        style={{ marginTop: 10 }}
        disabled={busy || !currentPassword || !newPassword || !confirmPassword}
        onClick={submit}
      >
        {busy ? "Saving…" : "Change password"}
      </button>
    </div>
  );
}

interface SecuritySettingsCardProps {
  /** Admin-only: shows a link to the Admin audit log. Business/Group don't
   * have an audit log page. */
  showAuditLogLink?: boolean;
}

/** Two-factor auth setup/disable plus change-password, shared across
 * Business, Group, and Admin — the same flows (against the logged-in user's
 * own account) no matter which portal it's opened from. */
function TwoFactorCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/auth/2fa")
      .then((res) => res.json())
      .then((d) => setEnabled(!!d.twoFactorEnabled));
  }

  useEffect(load, []);

  async function startSetup() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to start setup");
      return;
    }
    setQrCodeDataUrl(data.qrCodeDataUrl);
    setSecret(data.secret);
    setStep("setup");
    setCode("");
  }

  async function confirmSetup() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.message ?? "Incorrect code");
      return;
    }
    setStep("idle");
    setQrCodeDataUrl(null);
    setSecret(null);
    setCode("");
    load();
  }

  async function confirmDisable() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to disable");
      return;
    }
    setStep("idle");
    setPassword("");
    load();
  }

  return (
    <div className="card">
      <h3>Two-factor authentication</h3>
      <p className="card-sub">
        Adds a second step to signing in — a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password,
        etc.), in addition to your password.
      </p>

      {enabled === null && <p className="subtitle">Loading…</p>}

      {enabled === true && step === "idle" && (
        <>
          <p className="callout" style={{ marginTop: 10 }}>
            <span className="pill pill-green" style={{ marginRight: 8 }}>
              Enabled
            </span>
            Your account requires a code at login.
          </p>
          <button className="btn btn-sm" onClick={() => setStep("disable")}>
            Turn off 2FA
          </button>
        </>
      )}

      {enabled === false && step === "idle" && (
        <button className="btn btn-dark btn-sm" disabled={busy} onClick={startSetup}>
          {busy ? "Starting…" : "Set up two-factor authentication"}
        </button>
      )}

      {step === "setup" && (
        <div style={{ marginTop: 10, padding: 12, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
          <p className="card-sub" style={{ marginTop: 0 }}>
            Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="2FA QR code" style={{ width: 180, height: 180 }} />}
          {secret && (
            <p className="subtitle" style={{ marginTop: 6 }}>
              Can&apos;t scan? Enter this key manually: <code>{secret}</code>
            </p>
          )}
          <div className="field" style={{ marginTop: 10 }}>
            <label>6-digit code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-dark btn-sm" disabled={busy} onClick={confirmSetup}>
            {busy ? "Confirming…" : "Confirm and enable"}
          </button>{" "}
          <button className="btn btn-sm" onClick={() => setStep("idle")}>
            Cancel
          </button>
        </div>
      )}

      {step === "disable" && (
        <div style={{ marginTop: 10, padding: 12, background: "var(--bg-2, #f7f7f5)", borderRadius: 8 }}>
          <p className="card-sub" style={{ marginTop: 0 }}>
            Enter your password to confirm turning off two-factor authentication.
          </p>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={confirmDisable}>
            {busy ? "Turning off…" : "Turn off 2FA"}
          </button>{" "}
          <button className="btn btn-sm" onClick={() => setStep("idle")}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function SecuritySettingsCard({ showAuditLogLink = false }: SecuritySettingsCardProps) {
  return (
    <>
      <TwoFactorCard />
      <ChangePasswordCard />
      {showAuditLogLink && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Audit log</h3>
          <p className="card-sub">Every staff/role/permission change and other audited admin action, with before/after detail.</p>
          <Link className="btn btn-sm" href="/admin/audit-log" style={{ marginTop: 10, display: "inline-block" }}>
            View audit log →
          </Link>
        </div>
      )}
    </>
  );
}
