import { Suspense } from "react";
import { EmailDetail } from "@/components/mail/EmailDetail";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <EmailDetail id={id} />
    </Suspense>
  );
}
