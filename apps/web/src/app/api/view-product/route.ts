import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PRODUCTS } from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";
import { VIEW_PRODUCT_COOKIE } from "@/lib/viewProduct";

const PRODUCT_SET: readonly string[] = PRODUCTS;

// Sets which product an account with both enabled is currently viewing on
// the aggregate dashboards (Overview, Command Center, Branches, Compare,
// Regions, Reports). resolveViewProduct() re-validates this cookie's value
// against the account's actual enabledProducts on every read, so a stale
// or tampered cookie can never show a product the account isn't entitled
// to — this route only needs to reject garbage input, not authorize it.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (typeof body?.product !== "string" || !PRODUCT_SET.includes(body.product)) {
    return NextResponse.json({ status: "error", message: "Invalid product" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(VIEW_PRODUCT_COOKIE, body.product, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ status: "ok" });
}
