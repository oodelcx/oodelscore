import type { IRolePermissions } from "../models/Role";

const noAccess = { view: false, edit: false, delete: false };
const noScopedAccess = { ...noAccess, scope: "assigned" as const };

const adminPermissions: IRolePermissions = {
  businesses: { view: true, edit: true, delete: true, scope: "all" },
  parentOrgs: { view: true, edit: true, delete: true, scope: "all" },
  staffAndRoles: { view: true, edit: true, delete: true },
  billingOversight: { view: true, edit: true, delete: true },
  questionTemplates: { view: true, edit: true, delete: true },
  emailAndSiteContent: { view: true, edit: true, delete: true },
  aiInsightsQueue: { view: true, edit: true, delete: true, scope: "all" },
};

const accountManagerPermissions: IRolePermissions = {
  businesses: { view: true, edit: true, delete: false, scope: "assigned" },
  parentOrgs: { view: true, edit: true, delete: false, scope: "assigned" },
  staffAndRoles: { ...noAccess },
  billingOversight: { ...noAccess },
  questionTemplates: { view: true, edit: false, delete: false },
  emailAndSiteContent: { ...noAccess },
  aiInsightsQueue: { view: true, edit: true, delete: false, scope: "assigned" },
};

// Finance gets full financial visibility with no access to feedback data,
// staff, templates, or content. `businesses`/`parentOrgs` view access here is
// intentionally scoped "all" at the permission-object level (view only, no
// edit/delete) — restricting the *fields* returned (name/status only, per
// spec Section 4) must be enforced by the API's serializer, since this shape
// only expresses view/edit/delete/scope, not field-level visibility.
const financePermissions: IRolePermissions = {
  businesses: { view: true, edit: false, delete: false, scope: "all" },
  parentOrgs: { view: true, edit: false, delete: false, scope: "all" },
  staffAndRoles: { ...noAccess },
  billingOversight: { view: true, edit: true, delete: false },
  questionTemplates: { ...noAccess },
  emailAndSiteContent: { ...noAccess },
  aiInsightsQueue: { ...noScopedAccess },
};

export const SYSTEM_ROLES = [
  {
    name: "Admin",
    description: "Full platform control.",
    isSystemRole: true,
    permissions: adminPermissions,
  },
  {
    name: "Account manager",
    description: "Manages an assigned set of businesses/parent orgs and their AI Insights queue.",
    isSystemRole: true,
    permissions: accountManagerPermissions,
  },
  {
    name: "Finance",
    description: "Full financial visibility (Billing Oversight) without access to customer/feedback data.",
    isSystemRole: true,
    permissions: financePermissions,
  },
] as const;
