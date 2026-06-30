import { players } from "@/lib/site-data";

export async function GET() {
  return Response.json({ ok: true, players, updatedAt: Date.now() });
}
