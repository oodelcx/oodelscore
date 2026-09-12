import { Types } from "mongoose";
import { User, type AccountType } from "../models/User";
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
    inviteStatus: "invite_pending",
    inviteTokenHash: hash,
    inviteExpiresAt: expiresAt,
  });

  const setPasswordLink = `${params.appUrl}/set-password?uid=${user._id.toString()}&token=${token}`;
  await sendTemplatedEmail("welcome", email, { name: email, email, set_password_link: setPasswordLink });

  return user;
}
