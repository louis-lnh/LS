import { NextRequest } from "next/server";
import { attachVodFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth, requireString, requireUrl } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const matchId = requireString(body, "matchId", 80);
  const vodUrl = requireUrl(body, "vodUrl", 500);
  if (!matchId || !vodUrl) {
    return Response.json({ ok: false, code: "INVALID_VOD_PAYLOAD", error: "matchId and a valid http(s) vodUrl are required." }, { status: 400 });
  }

  const match = attachVodFromBot({ ...body, matchId, vodUrl });
  if (!match) {
    return Response.json({ ok: false, code: "MATCH_NOT_FOUND", error: "No match exists with that id." }, { status: 404 });
  }
  return Response.json({ ok: true, action: "vod.attach", persisted: true, match, updatedAt: Date.now() });
}
