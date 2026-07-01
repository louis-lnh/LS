import { getClips } from "@/lib/content-store";

export async function GET() {
  return Response.json({ ok: true, clips: getClips(), updatedAt: Date.now() });
}
