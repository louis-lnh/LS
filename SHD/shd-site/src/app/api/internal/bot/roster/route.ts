import { NextRequest } from "next/server";
import { acceptedScaffold, readJsonBody, requireBotAuth, requireString } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const displayName = requireString(body, "displayName", 80);
  const riotId = requireString(body, "riotId", 80);
  const status = requireString(body, "status", 40) ?? "main";
  if (!displayName || !riotId) {
    return Response.json({ ok: false, code: "INVALID_ROSTER_PAYLOAD", error: "displayName and riotId are required." }, { status: 400 });
  }

  return acceptedScaffold("roster.upsert", { ...body, displayName, riotId, status });
}
