import { SiteShell } from "@/components/site-shell";
import { MatchBoard, PageIntro } from "@/components/site-sections";
import { getMatches } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = getMatches();

  return (
    <SiteShell>
      <PageIntro eyebrow="Matches & VODs" title="Review-ready match history">
        Upcoming and completed games are structured around manual VOD review and quick team takeaways.
      </PageIntro>
      <MatchBoard matches={matches} />
    </SiteShell>
  );
}
