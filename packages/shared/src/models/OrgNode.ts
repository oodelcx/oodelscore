import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * One box in a group's own structure tree (a Region, an Area, a Cluster,
 * whatever tiers that group uses; see ParentOrganization.structure.tiers).
 * Branches hang off the lowest tier via Business.orgNodeId. The person who
 * runs the box (managerUserId) is one step in the escalation chain for every
 * branch beneath it.
 */
export interface IOrgNode {
  parentOrgId: Types.ObjectId;
  tierKey: string; // matches a key in the group's structure.tiers
  name: string; // "North Region", "Lahore Cluster"
  parentNodeId: Types.ObjectId | null; // the box one tier up, null for the top tier
  managerUserId: Types.ObjectId | null; // who handles escalations at this box
  managerTitle: string; // "Regional Manager"; empty = "<tier name> manager"
  createdAt: Date;
  updatedAt: Date;
}

const OrgNodeSchema = new Schema<IOrgNode>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", required: true },
    tierKey: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    parentNodeId: { type: Schema.Types.ObjectId, ref: "OrgNode", default: null },
    managerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    managerTitle: { type: String, default: "" },
  },
  { timestamps: true }
);

OrgNodeSchema.index({ parentOrgId: 1, tierKey: 1 });
OrgNodeSchema.index({ parentNodeId: 1 });

export const OrgNode: Model<IOrgNode> = mongoose.models.OrgNode ?? model<IOrgNode>("OrgNode", OrgNodeSchema);
