import { ClipGrid, PageIntro } from "@/components/site-sections";
import { SiteShell } from "@/components/site-shell";

export default function ClipsPage() {
  return (
    <SiteShell>
      <PageIntro eyebrow="Clips" title="Highlights without the clutter">
        The clips section is designed for YouTube, Twitch, Medal, or direct highlight links once content is connected.
      </PageIntro>
      <ClipGrid />
    </SiteShell>
  );
}
