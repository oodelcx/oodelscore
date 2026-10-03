import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { PRODUCTS, type Product } from "./products";

export const ACCOUNT_TYPES = ["admin_staff", "parent_org", "business", "team_member"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TEAM_MEMBER_TIERS = ["full", "limited"] as const;
export type TeamMemberTier = (typeof TEAM_MEMBER_TIERS)[number];

export const INVITE_STATUSES = ["active", "invite_pending", "invite_expired"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export interface IUser {
  email: string;
  passwordHash: string;
  accountType: AccountType;
  parentId: Types.ObjectId | null; // -> parentOrganizations._id or businesses._id, null for admin_staff
  roleId: Types.ObjectId | null; // -> roles._id (admin_staff only)
  teamRole: string; // team_member only — free text (e.g. "Shift Lead"), cosmetic, no permission effect
  // team_member only — which product(s) this person can see, independent of
  // which product(s) the business/org itself has bought (that's the outer
  // gate; this is the inner one — see getEnabledProducts()). null/empty
  // means customer_experience only, the same conservative default used
  // everywhere else in this build — a pre-existing team member never
  // silently gains Colleague Experience access just because their account
  // later turns it on; someone has to explicitly grant it.
  products: Product[] | null;
  tier: TeamMemberTier | null; // team_member only
  // "full" tier only — page keys (see features/teamPermissions.ts) this
  // person is explicitly denied, on top of the tier's baseline access.
  // Empty/[] = sees everything "full" tier normally sees. Meaningless for
  // "limited" tier, which is already locked to only its own cases.
  restrictedPages: string[];
  teamOfType: "business" | "parentOrg" | null; // team_member only — which collection parentId points at
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
  // Two-factor auth (TOTP). twoFactorSecret is only set once the user
  // scans the QR code and confirms a code — until then it's a pending
  // secret from /api/auth/2fa/setup that hasn't been verified yet, kept
  // separate so a half-finished setup never silently enables 2FA.
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorPendingSecret: string | null;
  // Guided-tour engine (Business/Parent Org portals only — never shown to
  // admin_staff): tour ids the user has completed or explicitly skipped,
  // so a first-login walkthrough doesn't nag a returning user. Persisted on
  // the account rather than localStorage since real staff switch
  // devices/browsers and shouldn't see it reappear just because they're on
  // a new machine. A tour can still be re-triggered anytime via the "Take a
  // tour" affordance regardless of this list.
  seenTours: string[];
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
    teamRole: { type: String, default: "" },
    products: { type: [String], enum: PRODUCTS, default: null },
    tier: { type: String, enum: TEAM_MEMBER_TIERS, default: null },
    restrictedPages: { type: [String], default: [] },
    teamOfType: { type: String, enum: ["business", "parentOrg"], default: null },
    inviteStatus: { type: String, enum: INVITE_STATUSES, default: "invite_pending" },
    inviteTokenHash: { type: String, default: null },
    inviteExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    twoFactorPendingSecret: { type: String, default: null },
    seenTours: { type: [String], default: [] },
  },
  { timestamps: true }
);

// email already gets a unique index from `unique: true` above (the login
// lookup) — parentId+accountType is the other hot filter: every team-member
// listing and every "find the owner login for this business/org" call.
UserSchema.index({ parentId: 1, accountType: 1 });

export const User: Model<IUser> = mongoose.models.User ?? model<IUser>("User", UserSchema);
