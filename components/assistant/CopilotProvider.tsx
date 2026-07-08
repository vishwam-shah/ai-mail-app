"use client";

import { CopilotKit } from "@copilotkit/react-core";
import type { ReactNode } from "react";

export function CopilotProvider({ children }: { children: ReactNode }) {
  return <CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>;
}
