import { NextResponse } from "next/server";
import { connectToDatabase, User, Business, sendTemplatedEmail, ANCHOR_DIMENSIONS, ANCHOR_DIMENSION_LABELS, REACH_DEFAULTS, type AnchorDimension } from "@oodelscore/shared";
import { getTooltips } from "@/lib/tooltips";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * REACH "Elevate": emails one person in this account a Compass recommendation,
 * so the weak area is visible to whoever can act on it. The recipient must
 * belong to this account.
 */
export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "compass" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const dimension = body?.dimension as AnchorDimension;
  if (!ANCHOR_DIMENSIONS.includes(dimension)) return NextResponse.json({ status: "error", message: "Unknown area" }, { status: 400 });
  const toUserId = typeof body?.toUserId === "string" ? body.toUserId : "";

  await connectToDatabase();
  const recipient = toUserId ? await User.findById(toUserId).catch(() => null) : null;
  const account = session.org;
  const branchIds = (await Business.find({ parentOrgId: account._id }).select("_id")).map((b) => String(b._id));
  if (!recipient || ![String(account._id), ...branchIds].includes(String(recipient.parentId))) {
    return NextResponse.json({ status: "error", message: "Pick someone from your own team." }, { status: 400 });
  }

  const tips = await getTooltips("compass-reach");
  const recognize = tips[`${dimension}-gap`] || REACH_DEFAULTS[dimension].gap;
  const elevate = tips[`${dimension}-elevate`] || REACH_DEFAULTS[dimension].elevate;
  try {
    await sendTemplatedEmail("compass_recommendation", recipient.email, {
      name: recipient.email,
      sender_name: session.user.email,
      account_name: account.name,
      dimension: ANCHOR_DIMENSION_LABELS[dimension],
      recognize,
      elevate,
      action_link: `${process.env.APP_URL ?? ""}/group/compass`,
    });
  } catch (err) {
    console.error("[compass] elevate email failed", err);
    return NextResponse.json({ status: "error", message: "The email could not be sent. Check that email sending is set up, then try again." }, { status: 502 });
  }
  return NextResponse.json({ status: "ok", sentTo: recipient.email });
}
