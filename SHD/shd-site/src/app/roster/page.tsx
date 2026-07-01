import { SiteShell } from "@/components/site-shell";
import { PageIntro, RosterSection } from "@/components/site-sections";
import { getMembers, getPlayers } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const players = getPlayers();
  const members = getMembers();

  return (
    <SiteShell>
      <PageIntro eyebrow="V26 ACT 4" title="The Premier Five">
        The five players representing SHD in Premier.
      </PageIntro>
      <RosterSection members={members} players={players} />
    </SiteShell>
  );
}
