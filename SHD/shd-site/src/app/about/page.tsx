import { AboutPanels, PageIntro } from "@/components/site-sections";
import { SiteShell } from "@/components/site-shell";

export default function AboutPage() {
  return (
    <SiteShell>
      <PageIntro eyebrow="About" title="Built for the team first">
        SHD Premier does not need public accounts or Riot dependency to be useful. It needs clean information, fast updates,
        and Discord-friendly control.
      </PageIntro>
      <AboutPanels />
    </SiteShell>
  );
}
