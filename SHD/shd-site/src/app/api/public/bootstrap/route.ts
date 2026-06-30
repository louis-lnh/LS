import { siteBootstrap } from "@/lib/site-data";

export async function GET() {
  return Response.json({ ok: true, bootstrap: siteBootstrap(), updatedAt: Date.now() });
}
