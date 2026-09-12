import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { AddressSchema, type IAddress } from "./common";

export const BILLING_MODES = ["group_pays", "branch_pays"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export interface IParentOrganization {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: IAddress;
  billingAddressSameAsAddress: boolean;
  defaultBillingMode: BillingMode; // default only for newly created businesses under this org
  accountManagerId: Types.ObjectId | null; // -> users._id (staff)
  branchSeatLimit: number | null; // ADMIN-EDITABLE ONLY. null = unlimited. Enforced against active business count.
  teamMemberSeatLimit: number | null; // ADMIN-EDITABLE ONLY. The Group's own staff pool, independent of any branch's.
  createdAt: Date;
  updatedAt: Date;
}

const ParentOrganizationSchema = new Schema<IParentOrganization>(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    address: { type: AddressSchema, default: () => ({}) },
    billingAddressSameAsAddress: { type: Boolean, default: true },
    defaultBillingMode: { type: String, enum: BILLING_MODES, default: "branch_pays" },
    accountManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    branchSeatLimit: { type: Number, default: null },
    teamMemberSeatLimit: { type: Number, default: null },
  },
  { timestamps: true }
);

export const ParentOrganization: Model<IParentOrganization> =
  mongoose.models.ParentOrganization ?? model<IParentOrganization>("ParentOrganization", ParentOrganizationSchema);
