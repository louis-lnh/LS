import { NextRequest } from "next/server";
import { deleteContentFromBot, updateMatchFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth } from "@/lib/internal-bot-api";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  const match = updateMatchFromBot(id, body ?? {});
  if (!match) {
    return Response.json({ ok: false, code: "MATCH_NOT_FOUND", error: "No match exists with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, action: "match.update", persisted: true, match, updatedAt: Date.now() });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const deletion = deleteContentFromBot("match", id);
  if (!deletion.removed) {
    return Response.json({ ok: false, code: "MATCH_NOT_FOUND", error: "No match exists with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, action: "match.delete", persisted: true, deletion, updatedAt: Date.now() });
}
