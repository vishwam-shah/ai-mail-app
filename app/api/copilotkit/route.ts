import {
  CopilotRuntime,
  GroqAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import Groq from "groq-sdk";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/api-guard";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// llama-3.3-70b-versatile (the adapter's default) was deprecated by Groq;
// always pin an explicit, currently-supported tool-calling model via env.
const serviceAdapter = new GroqAdapter({
  groq,
  model: process.env.GROQ_MODEL,
  disableParallelToolCalls: true,
});

const runtime = new CopilotRuntime();

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}
