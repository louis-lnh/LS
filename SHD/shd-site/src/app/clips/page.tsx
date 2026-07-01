import { ClipGrid, PageIntro } from "@/components/site-sections";
import { SiteShell } from "@/components/site-shell";
import { getClips } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function ClipsPage() {
  const clips = getClips();

  return (
    <SiteShell>
      <PageIntro eyebrow="Clips" title="Highlights without the clutter">
        The clips section is designed for YouTube, Twitch, Medal, or direct highlight links once content is connected.
      </PageIntro>
      <ClipGrid clips={clips} />
    </SiteShell>
  );
}
