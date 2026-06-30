import { NextRequest } from "next/server";
import { acceptedScaffold, readJsonBody, requireBotAuth, requireString } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const title = requireString(body, "title", 140);
  const player = requireString(body, "player", 80);
  const sourceUrl = requireString(body, "sourceUrl", 500);
  if (!title || !player || !sourceUrl) {
    return Response.json({ ok: false, code: "INVALID_CLIP_PAYLOAD", error: "title, player, and sourceUrl are required." }, { status: 400 });
  }

  return acceptedScaffold("clip.create", { ...body, title, player, sourceUrl });
}
