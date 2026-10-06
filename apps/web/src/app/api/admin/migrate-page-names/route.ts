import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/packages/shared/src/db";
import { SiteContent } from "@/packages/shared/src/models/SiteContent";
import { isAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();

    const menu = await SiteContent.findOne({ page: "menu" });
    if (!menu) {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }

    const updatedNavItems = menu.navItems.map((item: any) => ({
      ...item.toObject?.() || item,
      key:
        item.key === "product"
          ? "customer-x"
          : item.key === "colleague-pulse"
            ? "colleague-x"
            : item.key,
      label:
        item.key === "product"
          ? "Customer X"
          : item.key === "colleague-pulse"
            ? "Colleague X"
            : item.label,
    }));

    await SiteContent.updateOne(
      { page: "menu" },
      { $set: { navItems: updatedNavItems } }
    );

    const updated = await SiteContent.findOne({ page: "menu" });

    return NextResponse.json({
      success: true,
      navItems: updated?.navItems.map((item: any) => ({
        key: item.key,
        label: item.label,
      })),
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
