import Image from "next/image";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function HomePage() {
  return (
    <SiteShell>
      <section className="hero">
        <span className="hero-watermark" aria-hidden="true">S H D</span>
        <div className="hero-logo-wrap">
          <Image className="hero-logo" src="/brand/shd-logo.png" alt="SHD Esports" width={520} height={240} priority />
        </div>
        <span className="chip">Valorant Esports</span>
        <h1>
          <span>Team Hub</span>
        </h1>
        <p>Roster, matches, clips, and team updates for the active lineup.</p>
        <div className="hero-actions">
          <Link className="primary-action" href="/matches">View matches</Link>
          <Link className="secondary-action" href="/roster">Meet the roster</Link>
          <Link className="secondary-action" href="/clips">Watch clips</Link>
        </div>
      </section>
    </SiteShell>
  );
}
