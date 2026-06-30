import { matches } from "@/lib/site-data";

export async function GET() {
  return Response.json({ ok: true, matches, updatedAt: Date.now() });
}
