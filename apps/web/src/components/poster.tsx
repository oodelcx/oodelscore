import { PrintButton } from "./print-button";
import "./poster.css";

interface PosterProps {
  businessName: string;
  feedbackPointName: string;
  qrToken: string;
}

export function Poster({ businessName, feedbackPointName, qrToken }: PosterProps) {
  return (
    <div className="poster-page">
      <div className="poster-toolbar">
        <PrintButton />
      </div>
      <div className="poster-sheet">
        <div className="poster-eyebrow">We&rsquo;d love your feedback</div>
        <h1 className="poster-business">{businessName}</h1>
        <p className="poster-point">{feedbackPointName}</p>
        <img src={`/api/qr/${qrToken}`} alt={`QR code for ${feedbackPointName}`} className="poster-qr" width={320} height={320} />
        <p className="poster-instructions">Scan with your phone camera to share your feedback</p>
        <div className="poster-footer">Powered by OodelCX</div>
      </div>
    </div>
  );
}
