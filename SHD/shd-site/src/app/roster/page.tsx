import { SiteShell } from "@/components/site-shell";
import { PageIntro, RosterSection } from "@/components/site-sections";

export default function RosterPage() {
  return (
    <SiteShell>
      <PageIntro eyebrow="V26 ACT 4" title="The Premier Five">
        The five players representing SHD in Premier.
      </PageIntro>
      <RosterSection />
    </SiteShell>
  );
}
