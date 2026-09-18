"use client";

import { useRouter } from "next/navigation";

export default function LogoutLink() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div onClick={handleLogout} style={{ marginTop: 12, color: "#3fbe8b", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
      Log out
    </div>
  );
}
