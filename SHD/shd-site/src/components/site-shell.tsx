import Image from "next/image";
import Link from "next/link";

const navItems = [
  { href: "/roster", label: "Roster" },
  { href: "/matches", label: "Matches" },
  { href: "/clips", label: "Clips" },
  { href: "/stats", label: "Stats" },
  { href: "/about", label: "About" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="brand-mark" href="/" aria-label="SHD Esports home">
          <Image src="/brand/shd-logo-no-text.png" alt="" width={34} height={34} priority />
          <span>SHD Esports</span>
        </Link>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div>
          <strong>SHD Premier</strong>
          <span>Manual-first team website and future Discord-controlled content hub.</span>
        </div>
        <nav aria-label="Footer links">
          <Link href="/matches">VODs</Link>
          <Link href="/clips">Highlights</Link>
          <Link href="/about">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
