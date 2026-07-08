import { Suspense } from "react";
import { ComposeForm } from "@/components/mail/ComposeForm";

export default function ComposePage() {
  return (
    <Suspense fallback={null}>
      <ComposeForm />
    </Suspense>
  );
}
