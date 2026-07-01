import { getAnnouncements } from "@/lib/content-store";

export async function GET() {
  return Response.json({ ok: true, announcements: getAnnouncements(), updatedAt: Date.now() });
}
