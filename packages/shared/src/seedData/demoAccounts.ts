import { User } from "../models/User";
import { Role } from "../models/Role";
import { ParentOrganization } from "../models/ParentOrganization";
import { Business } from "../models/Business";
import { hashPassword } from "../auth/password";
import type { AccountType } from "../models/User";

/**
 * DEMO-ONLY fixtures for logging in as each of the four account types
 * described in the spec (Admin / Group / standalone Business /
 * Business-as-branch). Unlike the real invite flow (Section 3), these
 * accounts get a password set directly with inviteStatus "active" —
 * skipping the invite email, since the point is working credentials, not
 * exercising Resend delivery.
 *
 * Never run this against a production database.
 */
export const DEMO_ACCOUNTS = [
  { email: "admin.demo@oodelscore.com", password: "OodelDemo!Admin1", label: "Admin" },
  { email: "group.demo@oodelscore.com", password: "OodelDemo!Group1", label: "Group" },
  { email: "business.demo@oodelscore.com", password: "OodelDemo!Biz1", label: "Business (standalone)" },
  { email: "branch.demo@oodelscore.com", password: "OodelDemo!Branch1", label: "Business (branch)" },
] as const;

async function upsertUser(params: {
  email: string;
  password: string;
  accountType: AccountType;
  parentId?: string | null;
  roleId?: string | null;
}): Promise<void> {
  const passwordHash = await hashPassword(params.password);
  await User.updateOne(
    { email: params.email },
    {
      $set: {
        passwordHash,
        accountType: params.accountType,
        parentId: params.parentId ?? null,
        roleId: params.roleId ?? null,
        inviteStatus: "active",
        inviteTokenHash: null,
        inviteExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      $setOnInsert: { tokenVersion: 0 },
    },
    { upsert: true }
  );
}

/**
 * Idempotent — safe to call repeatedly, including on every app boot.
 * Assumes the caller has already called connectToDatabase(); does not
 * connect or disconnect itself, since callers may be a short-lived CLI
 * script or a long-running server process reusing an existing connection.
 */
export async function seedDemoAccounts(): Promise<typeof DEMO_ACCOUNTS> {
  const adminRole = await Role.findOne({ name: "Admin" });
  if (!adminRole) {
    throw new Error('Admin role not found — run "npm run seed" first to seed system roles.');
  }

  const group = await ParentOrganization.findOneAndUpdate(
    { name: "Acme Retail Group (Demo)" },
    {
      $setOnInsert: {
        name: "Acme Retail Group (Demo)",
        contactName: "Group Demo Contact",
        contactEmail: "group.demo@oodelscore.com",
        contactPhone: "",
        address: { street: "1 Demo Way", city: "Demo City", postcode: "00000" },
        billingAddressSameAsAddress: true,
        defaultBillingMode: "group_pays",
      },
    },
    { upsert: true, new: true }
  );

  const standaloneBusiness = await Business.findOneAndUpdate(
    { name: "The Coffee Spot (Demo)" },
    {
      $setOnInsert: {
        name: "The Coffee Spot (Demo)",
        industry: "Restaurant",
        parentOrgId: null,
        contactName: "Business Demo Contact",
        contactEmail: "business.demo@oodelscore.com",
        contactPhone: "",
        billingAssignment: "branch_pays",
        plan: "business_monthly",
        maxFeedbackPoints: 1,
        active: true,
      },
    },
    { upsert: true, new: true }
  );

  const branchBusiness = await Business.findOneAndUpdate(
    { name: "Acme Downtown (Demo)" },
    {
      $setOnInsert: {
        name: "Acme Downtown (Demo)",
        industry: "Retail",
        parentOrgId: group._id,
        contactName: "Branch Demo Contact",
        contactEmail: "branch.demo@oodelscore.com",
        contactPhone: "",
        billingAssignment: "group_pays",
        plan: "business_monthly",
        maxFeedbackPoints: 1,
        active: true,
      },
    },
    { upsert: true, new: true }
  );

  await upsertUser({
    email: DEMO_ACCOUNTS[0].email,
    password: DEMO_ACCOUNTS[0].password,
    accountType: "admin_staff",
    roleId: adminRole._id.toString(),
  });
  await upsertUser({
    email: DEMO_ACCOUNTS[1].email,
    password: DEMO_ACCOUNTS[1].password,
    accountType: "parent_org",
    parentId: group._id.toString(),
  });
  await upsertUser({
    email: DEMO_ACCOUNTS[2].email,
    password: DEMO_ACCOUNTS[2].password,
    accountType: "business",
    parentId: standaloneBusiness._id.toString(),
  });
  await upsertUser({
    email: DEMO_ACCOUNTS[3].email,
    password: DEMO_ACCOUNTS[3].password,
    accountType: "business",
    parentId: branchBusiness._id.toString(),
  });

  return DEMO_ACCOUNTS;
}
