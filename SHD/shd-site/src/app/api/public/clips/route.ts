import { clips } from "@/lib/site-data";

export async function GET() {
  return Response.json({ ok: true, clips, updatedAt: Date.now() });
}
