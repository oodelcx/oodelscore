import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * The running activity trail on an Action Board item — separate from
 * `resolutionNote` (the single final "what we decided" line that feeds the
 * Decision Log). Matches the Jira/Linear pattern: a comment feed for
 * back-and-forth while the item is being worked, plus one closing note on
 * resolution.
 */
export interface IActionItemComment {
  actionItemId: Types.ObjectId;
  authorId: Types.ObjectId;
  authorLabel: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActionItemCommentSchema = new Schema<IActionItemComment>(
  {
    actionItemId: { type: Schema.Types.ObjectId, ref: "ActionBoardItem", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorLabel: { type: String, required: true },
    body: { type: String, required: true },
  },
  { timestamps: true }
);

ActionItemCommentSchema.index({ actionItemId: 1, createdAt: 1 });

export const ActionItemComment: Model<IActionItemComment> =
  mongoose.models.ActionItemComment ?? model<IActionItemComment>("ActionItemComment", ActionItemCommentSchema);
