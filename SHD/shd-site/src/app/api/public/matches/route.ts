import { getMatches } from "@/lib/content-store";

export async function GET() {
  return Response.json({ ok: true, matches: getMatches(), updatedAt: Date.now() });
}
