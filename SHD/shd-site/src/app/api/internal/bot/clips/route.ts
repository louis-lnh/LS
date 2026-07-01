import { NextRequest } from "next/server";
import { createClipFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth, requireString, requireUrl } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const title = requireString(body, "title", 140);
  const player = requireString(body, "player", 80);
  const sourceUrl = requireUrl(body, "sourceUrl", 500);
  if (!title || !player || !sourceUrl) {
    return Response.json({ ok: false, code: "INVALID_CLIP_PAYLOAD", error: "title, player, and a valid http(s) sourceUrl are required." }, { status: 400 });
  }

  const clip = createClipFromBot({ ...body, title, player, sourceUrl });
  return Response.json({ ok: true, action: "clip.create", persisted: true, clip, updatedAt: Date.now() });
}
