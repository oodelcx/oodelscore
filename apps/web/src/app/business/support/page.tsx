import SupportTicketsClient from "@/components/support-tickets-client";

export default async function BusinessSupportPage() {
  return <SupportTicketsClient apiBase="/api/business/support-tickets" />;
}
