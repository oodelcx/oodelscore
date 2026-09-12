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
    <div onClick={handleLogout} style={{ marginTop: 12, color: "#9a9ea3", fontSize: 12.5, cursor: "pointer" }}>
      Log out
    </div>
  );
}
