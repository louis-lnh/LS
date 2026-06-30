import { NextRequest } from "next/server";
import { acceptedScaffold, readJsonBody, requireBotAuth, requireString } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  const result = requireString(body, "result", 20);
  const score = requireString(body, "score", 40);
  if (!result || !score) {
    return Response.json({ ok: false, code: "INVALID_MATCH_RESULT", error: "result and score are required." }, { status: 400 });
  }

  return acceptedScaffold("match.result", { ...body, id, result, score });
}
