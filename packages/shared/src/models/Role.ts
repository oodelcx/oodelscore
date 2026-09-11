import mongoose, { Schema, model, type Model } from "mongoose";

export const PERMISSION_SCOPES = ["all", "assigned"] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export interface ICrudPermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export interface IScopedCrudPermission extends ICrudPermission {
  scope: PermissionScope;
}

/**
 * Mirrors spec Section 2 (`roles.permissions`) and Section 4's permission matrix.
 * Any new admin-side feature must be added as a new key here AND to the matrix in the spec.
 */
export interface IRolePermissions {
  businesses: IScopedCrudPermission;
  parentOrgs: IScopedCrudPermission;
  staffAndRoles: ICrudPermission;
  billingOversight: ICrudPermission;
  questionTemplates: ICrudPermission;
  emailAndSiteContent: ICrudPermission;
  aiInsightsQueue: IScopedCrudPermission;
}

export interface IRole {
  name: string;
  description: string;
  isSystemRole: boolean; // true for Admin/Account manager/Finance, false for custom
  permissions: IRolePermissions;
  createdAt: Date;
  updatedAt: Date;
}

const CrudPermissionSchema = new Schema<ICrudPermission>(
  {
    view: { type: Boolean, required: true, default: false },
    edit: { type: Boolean, required: true, default: false },
    delete: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const ScopedCrudPermissionSchema = new Schema<IScopedCrudPermission>(
  {
    view: { type: Boolean, required: true, default: false },
    edit: { type: Boolean, required: true, default: false },
    delete: { type: Boolean, required: true, default: false },
    scope: { type: String, enum: PERMISSION_SCOPES, required: true, default: "assigned" },
  },
  { _id: false }
);

const RolePermissionsSchema = new Schema<IRolePermissions>(
  {
    businesses: { type: ScopedCrudPermissionSchema, required: true },
    parentOrgs: { type: ScopedCrudPermissionSchema, required: true },
    staffAndRoles: { type: CrudPermissionSchema, required: true },
    billingOversight: { type: CrudPermissionSchema, required: true },
    questionTemplates: { type: CrudPermissionSchema, required: true },
    emailAndSiteContent: { type: CrudPermissionSchema, required: true },
    aiInsightsQueue: { type: ScopedCrudPermissionSchema, required: true },
  },
  { _id: false }
);

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    isSystemRole: { type: Boolean, required: true, default: false },
    permissions: { type: RolePermissionsSchema, required: true },
  },
  { timestamps: true }
);

export const Role: Model<IRole> = mongoose.models.Role ?? model<IRole>("Role", RoleSchema);
