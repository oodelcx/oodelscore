import "../admin/admin.css";
import "../auth.css";
import { AuthShell } from "@/components/auth-shell";
import { getAuthVisual } from "@/lib/authVisual";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const visual = await getAuthVisual();

  return (
    <AuthShell headline={visual.headline} highlight={visual.highlight} imageUrl={visual.imageUrl}>
      <LoginForm />
    </AuthShell>
  );
}
