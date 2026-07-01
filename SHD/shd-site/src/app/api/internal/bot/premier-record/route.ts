import { NextRequest } from "next/server";
import { updatePremierRecordFromBot } from "@/lib/content-store";
import { readJsonBody, requireBotAuth } from "@/lib/internal-bot-api";

export async function POST(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const wins = Number(body?.wins);
  const losses = Number(body?.losses);
  if (!Number.isInteger(wins) || !Number.isInteger(losses) || wins < 0 || losses < 0) {
    return Response.json({ ok: false, code: "INVALID_PREMIER_RECORD", error: "wins and losses must be positive integers." }, { status: 400 });
  }

  const stats = updatePremierRecordFromBot({ ...body, wins, losses });
  return Response.json({ ok: true, action: "premier-record.update", persisted: true, stats, updatedAt: Date.now() });
}
