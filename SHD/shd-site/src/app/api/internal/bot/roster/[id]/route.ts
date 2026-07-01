import { NextRequest } from "next/server";
import { deleteContentFromBot } from "@/lib/content-store";
import { requireBotAuth } from "@/lib/internal-bot-api";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const deletion = deleteContentFromBot("roster", id);
  if (!deletion.removed) {
    return Response.json({ ok: false, code: "ROSTER_ENTRY_NOT_FOUND", error: "No roster entry exists with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, action: "roster.delete", persisted: true, deletion, updatedAt: Date.now() });
}
