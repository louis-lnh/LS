import { NextRequest } from "next/server";
import { requireBotAuth } from "@/lib/internal-bot-api";

export async function GET(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  return Response.json({
    ok: true,
    service: "shd-site",
    mode: "scaffold",
    capabilities: [
      "announcements",
      "roster",
      "matches",
      "match-results",
      "clips",
      "vods",
      "premier-record",
    ],
    persisted: false,
    message: "Internal bot API is reachable. Persistence lands with the database slice.",
    updatedAt: Date.now(),
  });
}
