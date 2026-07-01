import { getSiteBootstrap } from "@/lib/content-store";

export async function GET() {
  return Response.json({ ok: true, bootstrap: getSiteBootstrap(), updatedAt: Date.now() });
}
