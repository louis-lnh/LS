import { getControlContent } from "@/lib/content-store";

export async function GET() {
  const summary = getControlContent("summary", 1);

  return Response.json({
    ok: true,
    service: "shd-site",
    storage: "sqlite",
    counts: summary.counts,
    updatedAt: Date.now(),
  });
}
