import { SecuritySettingsCard } from "@/components/security-settings-card";

export default function BusinessSecurityPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Security</h1>
          <p className="subtitle">Manage how you sign in to your own account.</p>
        </div>
      </div>
      <SecuritySettingsCard />
    </div>
  );
}
