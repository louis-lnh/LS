import { NextRequest } from "next/server";
import { updateMatchResultFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth, requireString } from "@/lib/internal-bot-api";

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

  const match = updateMatchResultFromBot(id, { ...body, result, score });
  if (!match) {
    return Response.json({ ok: false, code: "MATCH_NOT_FOUND", error: "No match exists with that id." }, { status: 404 });
  }
  return Response.json({ ok: true, action: "match.result", persisted: true, match, updatedAt: Date.now() });
}
