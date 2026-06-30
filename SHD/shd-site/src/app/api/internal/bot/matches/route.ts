import { NextRequest } from "next/server";
import { acceptedScaffold, readJsonBody, requireBotAuth, requireString } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const opponent = requireString(body, "opponent", 120);
  const startsAt = requireString(body, "startsAt", 80);
  const eventType = requireString(body, "eventType", 40) ?? "Premier";
  if (!opponent || !startsAt) {
    return Response.json({ ok: false, code: "INVALID_MATCH_PAYLOAD", error: "opponent and startsAt are required." }, { status: 400 });
  }

  return acceptedScaffold("match.create", { ...body, opponent, startsAt, eventType });
}
