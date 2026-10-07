/**
 * Who may read a Sensitive case.
 *
 * A Sensitive case holds a concern about a senior leader or HR. It must not
 * be readable by anyone in the line of management beside or above the person
 * it concerns, so it is NOT visible to a branch owner or branch team just
 * because the case sits under that branch. It is visible only to:
 *  - the person it is assigned to (the confidential contact), and
 *  - when no contact is configured (ownerId null), the top owner login of the
 *    group, or of a standalone business. Never a branch.
 * Admin sees that such a case exists, never its text.
 *
 * This is the one definition: every list, detail and action route uses it.
 */
export interface CaseViewer {
  userId: string;
  /** True only for a group's top owner login, or a standalone business's owner login. */
  seesUnassignedSensitive: boolean;
}

/** Mongo clause to AND into any ActionBoardItem query a viewer can see. */
export function sensitiveVisibilityClause(viewer: CaseViewer): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [{ sensitive: { $ne: true } }, { ownerId: viewer.userId }];
  if (viewer.seesUnassignedSensitive) clauses.push({ ownerId: null });
  return { $or: clauses };
}

export function canViewCase(item: { sensitive?: boolean; ownerId?: { toString(): string } | null }, viewer: CaseViewer): boolean {
  if (!item.sensitive) return true;
  if (item.ownerId && item.ownerId.toString() === viewer.userId) return true;
  return !item.ownerId && viewer.seesUnassignedSensitive;
}
