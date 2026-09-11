import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const ACCOUNT_TYPES = ["admin_staff", "parent_org", "business"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const INVITE_STATUSES = ["active", "invite_pending", "invite_expired"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export interface IUser {
  email: string;
  passwordHash: string;
  accountType: AccountType;
  parentId: Types.ObjectId | null; // -> parentOrganizations._id or businesses._id, null for admin_staff
  roleId: Types.ObjectId | null; // -> roles._id (admin_staff only)
  inviteStatus: InviteStatus;
  inviteTokenHash: string | null;
  inviteExpiresAt: Date | null; // 7 days from send
  lastLoginAt: Date | null;
  // Bumped on every password change; embedded in issued JWTs so changing a
  // password invalidates all previously issued sessions (spec Section 3).
  tokenVersion: number;
  // Brute-force lockout (spec Section 3).
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    accountType: { type: String, enum: ACCOUNT_TYPES, required: true },
    // Polymorphic: points at parentOrganizations._id or businesses._id depending on accountType.
    parentId: { type: Schema.Types.ObjectId, default: null },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", default: null },
    inviteStatus: { type: String, enum: INVITE_STATUSES, default: "invite_pending" },
    inviteTokenHash: { type: String, default: null },
    inviteExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User ?? model<IUser>("User", UserSchema);
