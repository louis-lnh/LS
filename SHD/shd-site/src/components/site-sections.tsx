import Image from "next/image";
import { CoreRosterCarousel } from "@/components/core-roster-carousel";
import type { SiteStats } from "@/lib/content-store";
import type { Announcement, Clip, Match, Member, Player } from "@/lib/site-data";

const rankIcon = {
  "ascendant-1": "/ranks/ascendant-1.png",
  "diamond-1": "/ranks/diamond-1.png",
  "diamond-2": "/ranks/diamond-2.png",
  "gold-1": "/ranks/gold-1.png",
  "gold-3": "/ranks/gold-3.png",
  "immortal-2": "/ranks/immortal-2.png",
  "platinum-1": "/ranks/platinum-1.png",
};

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "TBD";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resultLabel(result: string) {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  return "Scheduled";
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PageIntro({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="section-intro page-intro">
      <span className="chip">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}

export function RosterSection({ members, players }: { members: Member[]; players: Player[] }) {
  return (
    <>
      {players.length > 0 ? (
        <CoreRosterCarousel players={players} />
      ) : (
        <section className="feature-panel page-section">
          <span className="panel-kicker">Roster</span>
          <h2>Core roster coming soon</h2>
          <p>The featured player cards will appear once the first core members are added.</p>
        </section>
      )}
      <section className="member-title page-section" aria-label="SHD members title">
        <h2>Full Roster</h2>
      </section>
      <section className="member-board-shell page-section" aria-label="SHD member leaderboard">
        <div className="member-board">
          <div className="member-board__header">
            <div className="member-board__col">#</div>
            <div className="member-board__col member-board__col--name">Name</div>
            <div className="member-board__col member-board__col--name">Riot ID</div>
            <div className="member-board__col">Peak</div>
            <div className="member-board__col">KDA</div>
            <div className="member-board__col">WIN</div>
            <div className="member-board__col">Matches</div>
            <div className="member-board__col">HS</div>
            <div className="member-board__col">ACS</div>
            <div className="member-board__col">Move</div>
          </div>
          <div className="member-board__body">
            {members.length > 0 ? (
              members.map((member) => (
                <article className="member-row" key={member.id}>
                  <span className="member-row__cell member-row__cell--rank">
                    #{member.rank}
                  </span>
                  <strong className="member-row__cell member-row__cell--name">{member.displayName}</strong>
                  <span className="member-row__cell member-row__cell--name member-row__riot">{member.riotId}</span>
                  <span className="member-row__cell member-row__cell--icon">
                    <Image src={rankIcon[member.peak] ?? "/ranks/gold-1.png"} alt="" width={34} height={34} />
                  </span>
                  <span className="member-row__cell">{member.kda}</span>
                  <span className="member-row__cell">{member.win}</span>
                  <span className="member-row__cell">{member.matches}</span>
                  <span className="member-row__cell">{member.hs}</span>
                  <span className="member-row__cell">{member.acs}</span>
                  <span className="member-row__cell member-row__cell--move">
                    <span className={`movement movement--${member.move}`}>
                      {member.move === "steady" ? "-" : "<"}
                    </span>
                  </span>
                </article>
              ))
            ) : (
              <article className="member-row">
                <strong className="member-row__cell member-row__cell--name">No members listed yet</strong>
              </article>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export function MatchBoard({ matches }: { matches: Match[] }) {
  const scheduledMatches = matches.filter((match) => match.status === "scheduled");
  const pastMatches = matches.filter((match) => match.status === "completed");

  return (
    <section className="match-board page-section">
      <MatchGroup title="Scheduled Matches" detail="Matches that are upcoming or still waiting on final result entry." matches={scheduledMatches} />
      <MatchGroup title="Past Matches" detail="Completed games with scores, VOD review notes, and takeaways." matches={pastMatches} />
    </section>
  );
}

function MatchGroup({ detail, matches: groupMatches, title }: { detail: string; matches: Match[]; title: string }) {
  return (
    <section className="match-group">
      <header className="match-group-header">
        <div>
          <span className="panel-kicker">{title}</span>
          <p>{detail}</p>
        </div>
        <strong>{groupMatches.length}</strong>
      </header>
      {groupMatches.length > 0 ? (
        groupMatches.map((match) => (
          <article className="match-row" key={match.id}>
            <div>
              <span className={`result-badge ${match.result}`}>{resultLabel(match.result)}</span>
              <h3>{match.opponent}</h3>
              <p>{match.reviewNotes || "Notes will be added after staff review."}</p>
            </div>
            <div className="match-meta">
              <Detail label="Date" value={formatDate(match.startsAt)} />
              <Detail label="Type" value={match.eventType} />
              <Detail label="Score" value={match.score || "-"} />
              <Detail label="Maps" value={match.maps.length ? match.maps.join(", ") : "TBD"} />
            </div>
          </article>
        ))
      ) : (
        <article className="match-row">
          <div>
            <span className="result-badge pending">Empty</span>
            <h3>No matches here yet</h3>
            <p>New entries will appear here once they are added through Discord.</p>
          </div>
        </article>
      )}
    </section>
  );
}

export function ClipGrid({ clips }: { clips: Clip[] }) {
  return (
    <section className="clip-grid page-section">
      {clips.length > 0 ? (
        clips.map((clip) => (
          <article className="clip-card" key={clip.id}>
            <div className="clip-thumb">
              <Image src={clip.thumbnail || "/brand/shd-logo-no-text.png"} alt="" width={420} height={260} />
            </div>
            <span className="panel-kicker">{clip.map || "TBD"}</span>
            <h3>{clip.title}</h3>
            <p>
              {clip.player} &middot; {formatDate(clip.publishedAt)}
            </p>
            <div className="agent-list">
              {(clip.tags.length ? clip.tags : ["highlight"]).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))
      ) : (
        <article className="feature-panel">
          <span className="panel-kicker">Clips</span>
          <h2>No clips posted yet</h2>
          <p>Highlights added through Discord will show up here.</p>
        </article>
      )}
    </section>
  );
}

export function StatsSnapshot({ stats }: { stats: SiteStats }) {
  return (
    <section className="stats-layout page-section">
      <article className="feature-panel">
        <span className="panel-kicker">{stats.seasonLabel}</span>
        <div className="stat-score">
          {stats.wins}-{stats.losses}
        </div>
        <p>Current seeded record for layout and backend contract testing.</p>
      </article>
      <article className="data-panel">
        <h3>Map Pool</h3>
        {(stats.mapStats.length ? stats.mapStats : [{ map: "TBD", record: "/", winRate: "/" }]).map((map) => (
          <div className="data-line" key={map.map}>
            <span>{map.map}</span>
            <strong>{map.record}</strong>
            <em>{map.winRate}</em>
          </div>
        ))}
      </article>
      <article className="data-panel">
        <h3>Agent Usage</h3>
        {(stats.agentUsage.length ? stats.agentUsage : [{ agent: "TBD", picks: 0 }]).map((agent) => (
          <div className="data-line" key={agent.agent}>
            <span>{agent.agent}</span>
            <strong>{agent.picks}</strong>
            <em>picks</em>
          </div>
        ))}
      </article>
    </section>
  );
}

export function AboutPanels({ announcements }: { announcements: Announcement[] }) {
  return (
    <section className="about-grid page-section">
      <article className="feature-panel">
        <span className="panel-kicker">Architecture</span>
        <h2>Website owns content</h2>
        <p>
          The site backend stores roster, matches, clips, stats, and announcements. The Discord bot controls it
          through internal endpoints.
        </p>
      </article>
      <article className="feature-panel">
        <span className="panel-kicker">Announcements</span>
        {announcements.length > 0 ? (
          announcements.map((item) => (
            <div className="announcement" key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))
        ) : (
          <div className="announcement">
            <strong>No announcements yet</strong>
            <p>Team updates added through Discord will appear here.</p>
          </div>
        )}
      </article>
    </section>
  );
}
