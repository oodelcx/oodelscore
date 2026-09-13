"use client";

import { useState } from "react";

interface QrModalProps {
  name: string;
  qrToken: string;
  posterHref: string;
  onClose: () => void;
}

/** Shared between Admin's and Business's Feedback Points pages — reuses
 * admin.css's modal-overlay-style patterns via its own small class set so
 * neither portal has to duplicate this. */
export function QrModal({ name, qrToken, posterHref, onClose }: QrModalProps) {
  const imgSrc = `/api/qr/${qrToken}`;
  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/feedback/${qrToken}` : `/feedback/${qrToken}`;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — the URL is still
      // shown as selectable text below for a manual copy.
    }
  }

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qr-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3>{name}</h3>
        <img src={imgSrc} alt={`QR code for ${name}`} className="qr-modal-image" width={220} height={220} />
        <div className="qr-modal-url">{publicUrl}</div>
        <div className="field-hint" style={{ margin: "4px 0 12px", textAlign: "center" }}>
          This same link works without printing a QR code — send it directly by SMS, email, or a receipt footer.
        </div>
        <div className="qr-modal-actions">
          <button type="button" className="btn" onClick={copyLink}>
            {copied ? "✓ Copied" : "🔗 Copy link"}
          </button>
          <a className="btn btn-dark" href={imgSrc} download={`${name.replace(/\s+/g, "-").toLowerCase()}-qr.png`}>
            ⬇ Download QR code (PNG)
          </a>
          <a className="btn" href={posterHref} target="_blank" rel="noreferrer">
            🖨 Open poster
          </a>
        </div>
      </div>
    </div>
  );
}
