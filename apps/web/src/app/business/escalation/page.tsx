import { EscalationSettingsClient } from "@/components/escalation-settings-client";

export default function BusinessEscalationPage() {
  return <EscalationSettingsClient apiPath="/api/business/escalation" />;
}
