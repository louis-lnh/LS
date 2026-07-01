import { getStats } from "@/lib/content-store";

export async function GET() {
  return Response.json({ ok: true, stats: getStats(), updatedAt: Date.now() });
}
