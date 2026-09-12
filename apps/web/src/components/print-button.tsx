"use client";

export function PrintButton() {
  return (
    <button type="button" className="poster-print-btn" onClick={() => window.print()}>
      🖨 Print / Save as PDF
    </button>
  );
}
