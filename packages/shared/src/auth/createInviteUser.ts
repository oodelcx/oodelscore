import { Types } from "mongoose";
import { User, type AccountType, type TeamMemberTier } from "../models/User";
import { generateSetPasswordToken } from "./tokens";
import { hashPassword } from "./password";
import { sendTemplatedEmail } from "../email/resend";

/**
 * Spec Section 3: "No password is ever set by Admin. Creating any account
 * (a business, org, or staff user) generates an invite token, sends the
 * welcome email via Resend with a set-password link, and sets inviteStatus:
 * 'invite_pending'." This is the one place that does that — used when an
 * admin_staff account is invited directly, and when a Business or Parent
 * Org is created (their owner login is created alongside it).
 */
export async function createInviteUser(params: {
  email: string;
  accountType: AccountType;
  parentId: Types.ObjectId | string | null;
  roleId?: Types.ObjectId | string | null;
  // team_member only (spec Section 16):
  teamRole?: string;
  tier?: TeamMemberTier;
  teamOfType?: "business" | "parentOrg";
  inviterName?: string;
  businessOrOrgName?: string;
  appUrl: string;
}) {
  const email = params.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const { token, hash, expiresAt } = generateSetPasswordToken();
  const placeholderHash = await hashPassword(token); // never a valid login until set-password overwrites it

  const user = await User.create({
    email,
    passwordHash: placeholderHash,
    accountType: params.accountType,
    parentId: params.parentId,
    roleId: params.accountType === "admin_staff" ? (params.roleId ?? null) : null,
    teamRole: params.accountType === "team_member" ? (params.teamRole ?? "") : "",
    tier: params.accountType === "team_member" ? (params.tier ?? "full") : null,
    teamOfType: params.accountType === "team_member" ? (params.teamOfType ?? null) : null,
    inviteStatus: "invite_pending",
    inviteTokenHash: hash,
    inviteExpiresAt: expiresAt,
  });

  const setPasswordLink = `${params.appUrl}/set-password?uid=${user._id.toString()}&token=${token}`;

  // Same invite-email mechanism as every other account type (spec Section 3)
  // — a team_member just uses the invite_to_team copy instead of welcome.
  if (params.accountType === "team_member") {
    await sendTemplatedEmail("invite_to_team", email, {
      name: email,
      inviter_name: params.inviterName ?? "Your team",
      business_name: params.businessOrOrgName ?? "",
      set_password_link: setPasswordLink,
    });
  } else {
    await sendTemplatedEmail("welcome", email, { name: email, email, set_password_link: setPasswordLink });
  }

  return user;
}
