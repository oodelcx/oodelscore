/**
 * A Team Member's permission is already checked server-side on every
 * protected API route (a 403 there is always correctly enforced), but a
 * limited-access member who navigates straight to a page's URL — bypassing
 * the nav link that would normally hide it — used to just see a silently
 * empty table with no explanation. This renders in its place instead.
 */
export function AccessDenied() {
  return (
    <div className="card empty">
      <div className="icon">🔒</div>
      <div style={{ fontWeight: 500, color: "var(--text)" }}>You don&apos;t have access to this page</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>
        Your account&apos;s permissions don&apos;t include this section. Contact your organization&apos;s admin if you
        think this is wrong.
      </div>
    </div>
  );
}
