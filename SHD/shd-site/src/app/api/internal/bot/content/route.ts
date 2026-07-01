import { NextRequest } from "next/server";
import { getControlContent } from "@/lib/content-store";
import { requireBotAuth } from "@/lib/internal-bot-api";

const contentTypes = ["summary", "roster", "matches", "clips", "announcements", "audit"] as const;

export async function GET(request: NextRequest) {
  const authError = requireBotAuth(request);
  if (authError) return authError;

  const typeParam = request.nextUrl.searchParams.get("type") ?? "summary";
  const type = contentTypes.includes(typeParam as (typeof contentTypes)[number])
    ? (typeParam as (typeof contentTypes)[number])
    : "summary";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 8);

  return Response.json({
    ok: true,
    persisted: true,
    content: getControlContent(type, limit),
    updatedAt: Date.now(),
  });
}
