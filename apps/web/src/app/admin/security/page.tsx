import { SecuritySettingsCard } from "@/components/security-settings-card";

export default function AdminSecurityPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Security</h1>
          <p className="subtitle">Manage how you sign in to your own admin account.</p>
        </div>
      </div>
      <SecuritySettingsCard />
    </div>
  );
}
