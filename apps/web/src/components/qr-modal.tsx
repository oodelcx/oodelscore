"use client";

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

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qr-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3>{name}</h3>
        <img src={imgSrc} alt={`QR code for ${name}`} className="qr-modal-image" width={220} height={220} />
        <div className="qr-modal-url">{publicUrl}</div>
        <div className="qr-modal-actions">
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
