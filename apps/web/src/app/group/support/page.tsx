import SupportTicketsClient from "@/components/support-tickets-client";

export default async function GroupSupportPage() {
  return <SupportTicketsClient apiBase="/api/group/support-tickets" />;
}
