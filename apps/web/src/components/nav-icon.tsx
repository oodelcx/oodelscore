/**
 * Small line-art icons for the drawer nav (Admin/Business/Group layouts) —
 * purely visual: each nav item keeps its exact existing href/label/gating,
 * this only adds a leading glyph. `stroke="currentColor"` so hover/active
 * recoloring (.admin-nav a:hover/.active in admin.css) applies to the icon
 * for free, no extra CSS needed. 17x17 viewBox, 1.6 stroke — matches the
 * sidebar's 13.5px nav-item text size better than the 24px icon set used
 * elsewhere (e.g. company/icons.tsx, sized for marketing page bodies).
 */
const PATHS: Record<string, string> = {
  dashboard: "M2.5 2.5h5.5v6h-5.5z M9.5 2.5h5v3.5h-5z M9.5 7.5h5v7h-5z M2.5 10h5.5v4.5h-5.5z",
  cases: "M2 5.5h13v8a1 1 0 01-1 1H3a1 1 0 01-1-1z M6 5.5V4a1 1 0 011-1h4a1 1 0 011 1v1.5",
  "feedback-points": "M8.5 15s5-4.2 5-8.3A5 5 0 003.5 6.7c0 4.1 5 8.3 5 8.3z|M8.5 8.7a2 2 0 100-4 2 2 0 000 4z",
  "category-owners": "M2.5 3h6l6 6-6.5 6.5-6-6z|M6 6h.01",
  roster: "M3 4h11M3 8.5h11M3 13h7|M13 12l1.5 1.5L16 11.5",
  "raw-feedback": "M2.5 4h12a1 1 0 011 1v6.5a1 1 0 01-1 1H7l-3 2.5v-2.5H2.5a1 1 0 01-1-1V5a1 1 0 011-1z",
  insights: "M8.5 2.5a4.5 4.5 0 00-2.5 8.2c.4.3.6.7.6 1.2v.6h4v-.6c0-.5.2-.9.6-1.2A4.5 4.5 0 008.5 2.5z|M6.8 15h3.4",
  analytics: "M2.5 14.5h12|M4.5 14.5V9|M8.5 14.5V5.5|M12.5 14.5V7.5",
  "alert-rules": "M3 5h10|M3 9h10|M3 13h10|M5 5v0M9 9v0M6 13v0",
  alerts: "M8.5 3a3.5 3.5 0 00-3.5 3.5c0 3.8-1.5 4.5-1.5 5.5h10c0-1-1.5-1.7-1.5-5.5A3.5 3.5 0 008.5 3z|M7 14.5a1.5 1.5 0 003 0",
  reports: "M4 2.5h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-11a1 1 0 011-1z|M10 2.5v3h3|M6 9h5|M6 11.5h5",
  "improvement-initiatives": "M2.5 13.5l4-4.5 3 2.5 4.5-6|M10.5 5.5h3.5v3.5",
  "decision-log": "M4 3h9a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z|M6 8l1.5 1.5L11 6",
  pulse: "M2 8.5h3l1.5-4 2.5 8 1.5-4h4",
  correlation: "M5.5 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z|M11.5 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z|M7.5 8h2",
  "team-members": "M6 8a2.2 2.2 0 100-4.4A2.2 2.2 0 006 8z|M2 14c0-2.5 1.8-4 4-4s4 1.5 4 4|M11.5 4.3a2 2 0 010 3.9|M12 10.2c1.7.3 2.5 1.6 2.5 3.8",
  support: "M8.5 14a5.5 5.5 0 100-11 5.5 5.5 0 000 11z|M8.5 6a2.5 2.5 0 100 5 2.5 2.5 0 000-5z|M4.8 4.8l2 2M12.2 4.8l-2 2M4.8 12.2l2-2M12.2 12.2l-2-2",
  billing: "M2 4.5h13a1 1 0 011 1V13a1 1 0 01-1 1H2a1 1 0 01-1-1V5.5a1 1 0 011-1z|M1 7.5h14",
  playbooks: "M3 3.5h5a1.5 1.5 0 011.5 1.5v9.5a1.5 1.5 0 00-1.5-1.5H3z|M14 3.5H9a1.5 1.5 0 00-1.5 1.5v9.5A1.5 1.5 0 0109 13H14z",
  security: "M8.5 2l5.5 2v4c0 4-2.3 6.7-5.5 8-3.2-1.3-5.5-4-5.5-8V4z",
  overview: "M2.5 2.5h5.5v6h-5.5z M9.5 2.5h5v3.5h-5z M9.5 7.5h5v7h-5z M2.5 10h5.5v4.5h-5.5z",
  "command-center": "M2.5 3.5h12v7h-12z|M6 14.5h5|M8.5 10.5v4",
  branches: "M4 3v6.5a3 3 0 003 3h3|M4 3a1.3 1.3 0 100-2.6A1.3 1.3 0 004 3z|M13 6a1.3 1.3 0 100-2.6A1.3 1.3 0 0013 6z|M13 6v3",
  compare: "M3 3h4.5v11H3z|M9.5 3H14v11H9.5z",
  team: "M6 8a2.2 2.2 0 100-4.4A2.2 2.2 0 006 8z|M2 14c0-2.5 1.8-4 4-4s4 1.5 4 4|M11.5 4.3a2 2 0 010 3.9|M12 10.2c1.7.3 2.5 1.6 2.5 3.8",
  accounts: "M3 14.5V6l5.5-4 5.5 4v8.5|M6.5 14.5v-4h4v4|M3 14.5h11",
  "question-templates": "M6 6.2a2.5 2.5 0 114 2c-.7.5-1 1-1 1.8v.3|M9 13v.01",
  categories: "M8.5 2.5l6 3.2-6 3.2-6-3.2z|M2.5 9.2l6 3.2 6-3.2|M2.5 12.4l6 3.2 6-3.2",
  industries: "M2.5 6h11v8h-11z|M5.5 6V4a1 1 0 011-1h4a1 1 0 011 1v2|M8.5 9v2.5",
  "email-templates": "M2 4.5h13v8h-13z|M2 4.5l6.5 5 6.5-5",
  "site-cms": "M8.5 14.5a6 6 0 100-12 6 6 0 000 12z|M2.5 8.5h12|M8.5 2.5c1.5 1.6 2.3 3.8 2.3 6s-.8 4.4-2.3 6c-1.5-1.6-2.3-3.8-2.3-6s.8-4.4 2.3-6z",
  "content-settings": "M8.5 6.3a2.2 2.2 0 100 4.4 2.2 2.2 0 000-4.4z|M13.7 8.5c0 .4 0 .7-.1 1.1l1.4 1.1-1.4 2.4-1.6-.6c-.6.5-1.3.8-2 1.1l-.2 1.7H7.2L7 12.6c-.7-.3-1.4-.6-2-1.1l-1.6.6-1.4-2.4 1.4-1.1c-.1-.4-.1-.7-.1-1.1s0-.7.1-1.1L2 7.3l1.4-2.4 1.6.6c.6-.5 1.3-.8 2-1.1l.2-1.7h2.6l.2 1.7c.7.3 1.4.6 2 1.1l1.6-.6L15 4.9l-1.4 1.1c.1.4.1.7.1 1.1z",
  "contact-messages": "M2.5 4.5h11a1 1 0 011 1v6.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V5.5a1 1 0 011-1z|M2.5 5.5l6 4.5 6-4.5",
  "feedback-responses": "M2.5 4h12a1 1 0 011 1v6.5a1 1 0 01-1 1H7l-3 2.5v-2.5H2.5a1 1 0 01-1-1V5a1 1 0 011-1z",
  "feedback-requests": "M4 3h9a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z|M6 6.5h5|M6 9h5|M6 11.5h3",
  "ai-queue": "M8.5 2.5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z|M13.5 10.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z",
  "platform-health": "M2 8.5h4v5h4v-9h4v4h1.5",
  "audit-log": "M8.5 14a5.5 5.5 0 100-11 5.5 5.5 0 000 11z|M8.5 5.5V8.5l2 1.5",
  "dev-tools": "M5 4l-3 4.5 3 4.5|M12 4l3 4.5-3 4.5|M10 3l-3 11",
  "attention-centre": "M8.5 2.5v3|M8.5 2.5a5.5 5.5 0 015.5 5.5c0 3-1 4.3-2 5.3H5c-1-1-2-2.3-2-5.3a5.5 5.5 0 015.5-5.5z|M6.5 15h4",
};

export function NavIcon({ name }: { name: string }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 17 17"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d.split("|").map((segment, i) => (
        <path key={i} d={segment} />
      ))}
    </svg>
  );
}
