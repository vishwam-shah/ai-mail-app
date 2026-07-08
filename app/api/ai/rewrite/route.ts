import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { requireSession } from "@/lib/api-guard";

const TONE_INSTRUCTIONS: Record<string, string> = {
  formal: "Rewrite this email body in a more formal, professional tone. Keep it business-appropriate.",
  shorter: "Rewrite this email body to be significantly more concise, keeping only the essential points.",
  longer: "Expand this email body with more detail and context while staying on topic.",
  friendly: "Rewrite this email body in a warmer, more friendly and casual tone.",
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { body, tone } = await request.json();
  const instruction = TONE_INSTRUCTIONS[tone];
  if (!body || !instruction) {
    return NextResponse.json({ error: "Invalid body or tone" }, { status: 400 });
  }

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content:
          "You rewrite email bodies. Return ONLY the rewritten email body text, no preamble, no quotes, no markdown, no subject line.",
      },
      { role: "user", content: `${instruction}\n\nOriginal email body:\n${body}` },
    ],
    temperature: 0.6,
  });

  const rewritten = completion.choices[0]?.message?.content?.trim();
  if (!rewritten) {
    return NextResponse.json({ error: "No response from model" }, { status: 502 });
  }

  return NextResponse.json({ body: rewritten });
}
