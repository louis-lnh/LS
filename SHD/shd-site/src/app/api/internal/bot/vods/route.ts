import { NextRequest } from "next/server";
import { acceptedScaffold, readJsonBody, requireBotAuth, requireString } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const matchId = requireString(body, "matchId", 80);
  const vodUrl = requireString(body, "vodUrl", 500);
  if (!matchId || !vodUrl) {
    return Response.json({ ok: false, code: "INVALID_VOD_PAYLOAD", error: "matchId and vodUrl are required." }, { status: 400 });
  }

  return acceptedScaffold("vod.attach", { ...body, matchId, vodUrl });
}
