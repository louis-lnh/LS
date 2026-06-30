import { stats } from "@/lib/site-data";

export async function GET() {
  return Response.json({ ok: true, stats, updatedAt: Date.now() });
}
