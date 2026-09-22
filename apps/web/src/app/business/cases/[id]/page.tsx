import BusinessCaseTrailClient from "./case-trail-client";

export default async function BusinessCaseTrailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BusinessCaseTrailClient caseId={id} />;
}
