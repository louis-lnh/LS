import { announcements } from "@/lib/site-data";

export async function GET() {
  return Response.json({ ok: true, announcements, updatedAt: Date.now() });
}
