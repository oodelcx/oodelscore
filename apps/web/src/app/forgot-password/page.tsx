import "../admin/admin.css";
import "../auth.css";
import { AuthShell } from "@/components/auth-shell";
import { getAuthVisual } from "@/lib/authVisual";
import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const visual = await getAuthVisual();

  return (
    <AuthShell headline={visual.headline} highlight={visual.highlight} imageUrl={visual.imageUrl}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
