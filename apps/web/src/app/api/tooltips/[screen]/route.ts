import { NextResponse } from "next/server";
import { getTooltips } from "@/lib/tooltips";

type RouteParams = { params: Promise<{ screen: string }> };

/**
 * Client-fetchable wrapper around getTooltips (@/lib/tooltips) — lets pages
 * that used to `await getTooltips(...)` in a server component instead fetch
 * tooltip copy from the client, in parallel with their own data fetch,
 * rather than blocking the initial HTML on a DB round trip. No auth check:
 * tooltip copy is static, non-sensitive UI text, same as what the server
 * component version rendered into public HTML before.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { screen } = await params;
  const tooltips = await getTooltips(screen);
  return NextResponse.json({ status: "ok", tooltips });
}
