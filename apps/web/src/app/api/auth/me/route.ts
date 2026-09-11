import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", message: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    status: "ok",
    user: {
      id: user._id.toString(),
      email: user.email,
      accountType: user.accountType,
      roleId: user.roleId?.toString() ?? null,
      parentId: user.parentId?.toString() ?? null,
    },
  });
}
