import { NextRequest } from "next/server";
import { createAnnouncementFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth, requireString } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const title = requireString(body, "title", 120);
  const bodyText = requireString(body, "body", 2000);
  const kind = requireString(body, "kind", 40) ?? "site";
  if (!title || !bodyText) {
    return Response.json({ ok: false, code: "INVALID_ANNOUNCEMENT", error: "title and body are required." }, { status: 400 });
  }

  const announcement = createAnnouncementFromBot({ title, body: bodyText, kind, actor: request.headers.get("x-shd-actor") ?? "discord-bot" });
  return Response.json({ ok: true, action: "announcement.create", persisted: true, announcement, updatedAt: Date.now() });
}
