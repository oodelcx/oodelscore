import GroupCaseTrailClient from "./case-trail-client";

export default async function GroupCaseTrailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupCaseTrailClient caseId={id} />;
}
