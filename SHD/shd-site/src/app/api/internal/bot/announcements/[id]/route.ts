import { NextRequest } from "next/server";
import { deleteContentFromBot, updateAnnouncementFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth } from "@/lib/internal-bot-api";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  const announcement = updateAnnouncementFromBot(id, body ?? {});
  if (!announcement) {
    return Response.json({ ok: false, code: "ANNOUNCEMENT_NOT_FOUND", error: "No announcement exists with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, action: "announcement.update", persisted: true, announcement, updatedAt: Date.now() });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const deletion = deleteContentFromBot("announcement", id);
  if (!deletion.removed) {
    return Response.json({ ok: false, code: "ANNOUNCEMENT_NOT_FOUND", error: "No announcement exists with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, action: "announcement.delete", persisted: true, deletion, updatedAt: Date.now() });
}
