import { EscalationSettingsClient } from "@/components/escalation-settings-client";

export default function GroupEscalationPage() {
  return <EscalationSettingsClient apiPath="/api/group/escalation" regions={[]} />;
}
