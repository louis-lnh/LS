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
      "content-summary",
      "audit-summary",
      "content-edit",
      "content-delete",
    ],
    persisted: true,
    storage: "sqlite",
    message: "Internal bot API is reachable and writes to SQLite.",
    updatedAt: Date.now(),
  });
}
