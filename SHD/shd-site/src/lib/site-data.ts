export type Player = {
  id: string;
  displayName: string;
  handle: string;
  role: string;
  agents: string[];
  peak: RankPeak;
  status: "main" | "sub" | "staff" | "inactive";
  bio: string;
  stats: {
    hs: string;
    win: string;
    kda: string;
  };
  socials: {
    discord?: string;
    twitch?: string;
    youtube?: string;
    x?: string;
  };
};

export type RankPeak = "ascendant-1" | "diamond-1" | "diamond-2" | "gold-1" | "platinum-1" | "immortal-2" | "gold-3";

export type Member = {
  id: string;
  rank: number;
  displayName: string;
  riotId: string;
  peak: RankPeak;
  kda: string;
  win: string;
  matches: string;
  hs: string;
  acs: string;
  move: "up" | "down" | "steady";
};

export type Match = {
  id: string;
  startsAt: string;
  opponent: string;
  eventType: "Premier" | "Scrim" | "Tournament" | "Showmatch";
  status: "scheduled" | "completed";
  result: "win" | "loss" | "pending";
  score: string;
  maps: string[];
  vodUrl?: string;
  reviewNotes: string;
  mvp?: string;
  takeaways: string[];
};

export type Clip = {
  id: string;
  title: string;
  player: string;
  map: string;
  sourceUrl: string;
  thumbnail: string;
  tags: string[];
  featured: boolean;
  publishedAt: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: "match" | "result" | "roster" | "clip" | "site";
  publishedAt: string;
};

export const players: Player[] = [
  {
    id: "player-1",
    displayName: "Xadi",
    handle: "Chessmannnn#ZGDXx",
    role: "Premier Core",
    agents: ["Skye", "Sova", "Sage"],
    peak: "platinum-1",
    status: "main",
    bio: "SHD Premier core member.",
    stats: { hs: "/", win: "/", kda: "/" },
    socials: {},
  },
  {
    id: "player-2",
    displayName: "Max",
    handle: "L4M4#5454",
    role: "Premier Core",
    agents: ["Cypher", "Chamber", "Astra"],
    peak: "diamond-2",
    status: "main",
    bio: "SHD Premier core member.",
    stats: { hs: "/", win: "/", kda: "/" },
    socials: {},
  },
  {
    id: "player-3",
    displayName: "Luigi",
    handle: "Gambit εïз#shd",
    role: "Premier Core",
    agents: ["Jett", "Clove", "Miks"],
    peak: "ascendant-1",
    status: "main",
    bio: "SHD Premier core member.",
    stats: { hs: "/", win: "/", kda: "/" },
    socials: {},
  },
  {
    id: "player-4",
    displayName: "Tom",
    handle: "p1chUU#PRX",
    role: "Premier Core",
    agents: ["Viper", "Yoru", "Astra"],
    peak: "ascendant-1",
    status: "main",
    bio: "SHD Premier core member.",
    stats: { hs: "/", win: "/", kda: "/" },
    socials: {},
  },
  {
    id: "player-5",
    displayName: "Flo",
    handle: "Kaeru#fr0g",
    role: "Premier Core",
    agents: ["Vyse", "Skye", "Brim"],
    peak: "gold-1",
    status: "main",
    bio: "SHD Premier core member.",
    stats: { hs: "/", win: "/", kda: "/" },
    socials: {},
  },
];

export const members: Member[] = [
  {
    id: "member-1",
    rank: 1,
    displayName: "Luigi",
    riotId: "Gambit εïз#shd",
    peak: "ascendant-1",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-2",
    rank: 2,
    displayName: "Tom",
    riotId: "p1chUU#PRX",
    peak: "ascendant-1",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-3",
    rank: 3,
    displayName: "Max",
    riotId: "L4M4#5454",
    peak: "diamond-2",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-4",
    rank: 4,
    displayName: "Flo",
    riotId: "Kaeru#fr0g",
    peak: "gold-1",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-5",
    rank: 5,
    displayName: "Xadi",
    riotId: "Chessmannnn#ZGDXx",
    peak: "platinum-1",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-6",
    rank: 6,
    displayName: "Florian",
    riotId: "floripori#nix",
    peak: "gold-3",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-7",
    rank: 7,
    displayName: "Strawberry",
    riotId: "Crucible εïз#shd",
    peak: "ascendant-1",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-8",
    rank: 8,
    displayName: "Apathy",
    riotId: "Apathy#xxx1",
    peak: "immortal-2",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
  {
    id: "member-9",
    rank: 9,
    displayName: "Basura",
    riotId: "basuraa#shd",
    peak: "diamond-1",
    kda: "/",
    win: "/",
    matches: "/",
    hs: "/",
    acs: "/",
    move: "steady",
  },
];

export const matches: Match[] = [
  {
    id: "match-1",
    startsAt: "2026-07-03T19:00:00+02:00",
    opponent: "TBD Premier Opponent",
    eventType: "Premier",
    status: "scheduled",
    result: "pending",
    score: "-",
    maps: ["TBD"],
    reviewNotes: "Preparation focus: default discipline, anti-eco spacing, and retake communication.",
    takeaways: ["Confirm map pool", "Warmup starts 45 minutes before queue", "Assign VOD reviewer after match"],
  },
  {
    id: "match-2",
    startsAt: "2026-06-24T20:30:00+02:00",
    opponent: "Practice Stack",
    eventType: "Scrim",
    status: "completed",
    result: "win",
    score: "13-9",
    maps: ["Ascent"],
    vodUrl: "https://example.com/vod/ascent-review",
    reviewNotes: "Good defensive adaptation after round six. Attack side needs cleaner post-plant spacing.",
    mvp: "Luigi",
    takeaways: ["Mid control improved", "Post-plant fights too isolated", "Keep timeout earlier on economy swings"],
  },
  {
    id: "match-3",
    startsAt: "2026-06-21T19:30:00+02:00",
    opponent: "Haven Trial",
    eventType: "Scrim",
    status: "completed",
    result: "loss",
    score: "10-13",
    maps: ["Haven"],
    vodUrl: "https://example.com/vod/haven-review",
    reviewNotes: "Lost too many late-round rotates. Defensive C pressure created value but was not converted.",
    mvp: "Max",
    takeaways: ["Review late-round caller handoff", "Retake utility was strong", "Need cleaner bonus-round plans"],
  },
];

export const clips: Clip[] = [
  {
    id: "clip-1",
    title: "Jett entry opens the site",
    player: "Luigi",
    map: "Ascent",
    sourceUrl: "https://example.com/clips/raze-entry",
    thumbnail: "/brand/shd-logo-no-text.png",
    tags: ["entry", "jett", "featured"],
    featured: true,
    publishedAt: "2026-06-24T21:10:00+02:00",
  },
  {
    id: "clip-2",
    title: "1v2 retake with perfect setup",
    player: "Max",
    map: "Haven",
    sourceUrl: "https://example.com/clips/recon-retake",
    thumbnail: "/brand/shd-logo-no-text.png",
    tags: ["retake", "cypher"],
    featured: false,
    publishedAt: "2026-06-21T20:40:00+02:00",
  },
  {
    id: "clip-3",
    title: "Controller lurk closes the half",
    player: "Tom",
    map: "Lotus",
    sourceUrl: "https://example.com/clips/controller-lurk",
    thumbnail: "/brand/shd-logo-no-text.png",
    tags: ["lurk", "clutch"],
    featured: false,
    publishedAt: "2026-06-19T22:00:00+02:00",
  },
];

export const announcements: Announcement[] = [
  {
    id: "announcement-1",
    title: "SHD Premier site shell is live",
    body: "The public layout and backend contract are being prepared with seed data before final roster and match content goes in.",
    kind: "site",
    publishedAt: "2026-06-27T23:40:00+02:00",
  },
  {
    id: "announcement-2",
    title: "Next Premier block in preparation",
    body: "Staff can stage upcoming matches, VOD reviews, and clips once the admin portal section is connected.",
    kind: "match",
    publishedAt: "2026-06-27T23:45:00+02:00",
  },
];

export const stats = {
  seasonLabel: "Premier Stage",
  wins: 1,
  losses: 1,
  mapsPlayed: 2,
  roundDifference: 1,
  mapStats: [
    { map: "Ascent", record: "1-0", winRate: "100%" },
    { map: "Haven", record: "0-1", winRate: "0%" },
    { map: "Lotus", record: "0-0", winRate: "staged" },
  ],
  agentUsage: [
    { agent: "Jett", picks: 2 },
    { agent: "Sova", picks: 2 },
    { agent: "Astra", picks: 1 },
    { agent: "Cypher", picks: 1 },
  ],
  playerHighlights: [
    { player: "Luigi", label: "Opening duels", value: "/" },
    { player: "Max", label: "Setup impact", value: "/" },
    { player: "Tom", label: "Controller rounds", value: "/" },
  ],
};

export function siteBootstrap() {
  const nextMatch = matches.find((match) => match.status === "scheduled") ?? null;
  const latestResult = matches.find((match) => match.status === "completed") ?? null;
  const featuredClip = clips.find((clip) => clip.featured) ?? clips[0] ?? null;

  return {
    team: {
      name: "SHD Esports",
      focus: "Premier VALORANT Team",
      intro:
        "A focused SHD Premier roster hub for matches, VOD reviews, clips, and manually curated progress.",
    },
    nextMatch,
    latestResult,
    featuredClip,
    stats,
    announcements: announcements.slice(0, 3),
  };
}
