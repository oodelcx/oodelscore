import type { HydratedDocument, Types } from "mongoose";
import { RosterEntry } from "../models/RosterEntry";
import { ClosingLoopUpdate, type IClosingLoopUpdate } from "../models/ClosingLoopUpdate";
import { sendTemplatedEmail } from "../email/resend";

export interface SendClosingLoopUpdateResult {
  sent: number;
  failed: number;
}

/**
 * Sends a drafted "you said, we did" update to every active (endDate null)
 * roster entry across the update's affected businesses — a broadcast, not a
 * per-response reply, since Colleague Experience never links a response
 * back to who sent it (see RosterSurveyToken's own comment). Mirrors
 * lifecycleTriggers.ts's per-person send loop: one email failure never
 * blocks the rest of the roster, and the update is only marked sent once
 * the send pass actually runs (never optimistically before).
 */
export async function sendClosingLoopUpdate(
  update: HydratedDocument<IClosingLoopUpdate>
): Promise<SendClosingLoopUpdateResult> {
  const businessIds: Types.ObjectId[] =
    update.affectedBusinessIds.length > 0 ? update.affectedBusinessIds : update.businessId ? [update.businessId] : [];

  const recipients = await RosterEntry.find({ businessId: { $in: businessIds }, endDate: null }).select("email");

  const result: SendClosingLoopUpdateResult = { sent: 0, failed: 0 };
  for (const entry of recipients) {
    try {
      await sendTemplatedEmail("you_said_we_did", entry.email, {
        update_title: update.title,
        what_we_heard: update.whatWeHeard,
        what_were_doing: update.whatWereDoing,
      });
      result.sent++;
    } catch (err) {
      console.error("[closing-loop] failed to send you_said_we_did to a roster entry", err);
      result.failed++;
    }
  }

  update.status = "sent";
  update.sentAt = new Date();
  update.recipientCount = result.sent;
  await update.save();

  return result;
}
