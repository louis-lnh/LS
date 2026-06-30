import { PageIntro, StatsSnapshot } from "@/components/site-sections";
import { SiteShell } from "@/components/site-shell";

export default function StatsPage() {
  return (
    <SiteShell>
      <PageIntro eyebrow="Stats" title="Premier snapshot">
        Manual snapshots first, derived stats later. This keeps launch unblocked while the data model settles.
      </PageIntro>
      <StatsSnapshot />
    </SiteShell>
  );
}
