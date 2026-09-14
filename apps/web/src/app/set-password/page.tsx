import "../admin/admin.css";
import "../auth.css";
import { AuthShell } from "@/components/auth-shell";
import { getAuthVisual } from "@/lib/authVisual";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const visual = await getAuthVisual();

  return (
    <AuthShell headline={visual.headline} highlight={visual.highlight} imageUrl={visual.imageUrl}>
      <SetPasswordForm />
    </AuthShell>
  );
}
