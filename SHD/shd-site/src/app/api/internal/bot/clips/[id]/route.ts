import { NextRequest } from "next/server";
import { deleteContentFromBot, updateClipFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth } from "@/lib/internal-bot-api";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  const clip = updateClipFromBot(id, body ?? {});
  if (!clip) {
    return Response.json({ ok: false, code: "CLIP_NOT_FOUND", error: "No clip exists with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, action: "clip.update", persisted: true, clip, updatedAt: Date.now() });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const deletion = deleteContentFromBot("clip", id);
  if (!deletion.removed) {
    return Response.json({ ok: false, code: "CLIP_NOT_FOUND", error: "No clip exists with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, action: "clip.delete", persisted: true, deletion, updatedAt: Date.now() });
}
