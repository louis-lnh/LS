import { getMembers, getPlayers } from "@/lib/content-store";

export async function GET() {
  return Response.json({ ok: true, players: getPlayers(), members: getMembers(), updatedAt: Date.now() });
}
