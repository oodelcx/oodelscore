import { User } from "../models/User";

/**
 * Spec Section 13 bug #3: nothing ever flipped `inviteStatus` from
 * "invite_pending" to "invite_expired" once the 7-day token window passed,
 * so pending invites just looked pending forever (or, per the bug report,
 * every seeded account showed as expired with no way to tell why). Call
 * this before any admin view that lists invite status.
 */
export async function expireStaleInvites(): Promise<void> {
  await User.updateMany(
    { inviteStatus: "invite_pending", inviteExpiresAt: { $lt: new Date() } },
    { $set: { inviteStatus: "invite_expired" } }
  );
}
