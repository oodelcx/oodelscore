import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { connectToDatabase, ParentOrganization, Business } from "@oodelscore/shared";
import LogoutButton from "./logout-button";

async function resolveParentName(accountType: string, parentId: unknown): Promise<string | null> {
  if (!parentId) return null;
  await connectToDatabase();
  if (accountType === "parent_org") {
    const org = await ParentOrganization.findById(parentId);
    return org?.name ?? null;
  }
  if (accountType === "business") {
    const business = await Business.findById(parentId);
    return business?.name ?? null;
  }
  return null;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Admin has a real portal now (Milestone 3) — send admin_staff straight
  // there instead of the placeholder below. Group/Business accounts still
  // land here since their portals don't exist yet.
  if (user.accountType === "admin_staff") redirect("/admin/accounts");

  const parentName = await resolveParentName(user.accountType, user.parentId);

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Oodel Score</h1>
      <p>
        Logged in as <strong>{user.email}</strong>
      </p>
      <p>Account type: {user.accountType}</p>
      {parentName && <p>Attached to: {parentName}</p>}
      <p style={{ color: "#666" }}>
        This is a placeholder landing page — the Group and Business portals get built against the
        mockups in a later milestone.
      </p>
      <LogoutButton />
    </main>
  );
}
