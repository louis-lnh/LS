import { SiteShell } from "@/components/site-shell";
import { MatchBoard, PageIntro } from "@/components/site-sections";

export default function MatchesPage() {
  return (
    <SiteShell>
      <PageIntro eyebrow="Matches & VODs" title="Review-ready match history">
        Upcoming and completed games are structured around manual VOD review and quick team takeaways.
      </PageIntro>
      <MatchBoard />
    </SiteShell>
  );
}
