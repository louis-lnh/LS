import { PageIntro, StatsSnapshot } from "@/components/site-sections";
import { SiteShell } from "@/components/site-shell";
import { getStats } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = getStats();

  return (
    <SiteShell>
      <PageIntro eyebrow="Stats" title="Premier snapshot">
        Manual snapshots first, derived stats later. This keeps launch unblocked while the data model settles.
      </PageIntro>
      <StatsSnapshot stats={stats} />
    </SiteShell>
  );
}
