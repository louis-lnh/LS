import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import {
  announcements as seedAnnouncements,
  clips as seedClips,
  matches as seedMatches,
  members as seedMembers,
  players as seedPlayers,
  stats as seedStats,
  type Announcement,
  type Clip,
  type Match,
  type Member,
  type Player,
  type RankPeak,
} from "@/lib/site-data";

type Db = Database.Database;
type DbRow = Record<string, unknown>;
type ControlContentType = "summary" | "roster" | "matches" | "clips" | "announcements" | "audit";
type DeleteContentType = "match" | "clip" | "announcement" | "roster";

let db: Db | null = null;

const now = () => Date.now();

export type SiteStats = typeof seedStats;

export function getContentDb() {
  if (!db) {
    const configuredDbPath = process.env.SHD_SITE_DB_FILE;
    const dbPath = configuredDbPath
      ? isAbsolute(configuredDbPath)
        ? configuredDbPath
        : join(/* turbopackIgnore: true */ process.cwd(), configuredDbPath)
      : join(/* turbopackIgnore: true */ process.cwd(), "data", "shd-site.sqlite");
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seedIfEmpty(db);
  }
  return db;
}

export function getPlayers() {
  return getContentDb()
    .prepare("SELECT * FROM players ORDER BY sort_order ASC, created_at ASC")
    .all()
    .map((row) => rowToPlayer(row as DbRow));
}

export function getMembers() {
  return getContentDb()
    .prepare("SELECT * FROM members ORDER BY rank ASC, created_at ASC")
    .all()
    .map((row) => rowToMember(row as DbRow));
}

export function getMatches() {
  return getContentDb()
    .prepare("SELECT * FROM matches ORDER BY starts_at DESC, created_at DESC")
    .all()
    .map((row) => rowToMatch(row as DbRow));
}

export function getClips() {
  return getContentDb()
    .prepare("SELECT * FROM clips ORDER BY published_at DESC, created_at DESC")
    .all()
    .map((row) => rowToClip(row as DbRow));
}

export function getAnnouncements() {
  return getContentDb()
    .prepare("SELECT * FROM announcements ORDER BY published_at DESC, created_at DESC")
    .all()
    .map((row) => rowToAnnouncement(row as DbRow));
}

export function getStats() {
  const row = getContentDb().prepare("SELECT * FROM stat_snapshots ORDER BY updated_at DESC LIMIT 1").get();
  if (!row) return seedStats;
  return rowToStats(row as DbRow);
}

export function getSiteBootstrap() {
  const matches = getMatches();
  const clips = getClips();
  const announcements = getAnnouncements();
  const stats = getStats();
  const nextMatch = matches.find((match) => match.status === "scheduled") ?? null;
  const latestResult = matches.find((match) => match.status === "completed") ?? null;
  const featuredClip = clips.find((clip) => clip.featured) ?? clips[0] ?? null;

  return {
    team: {
      name: "SHD Esports",
      focus: "Premier VALORANT Team",
      intro: "A focused SHD Premier roster hub for matches, VOD reviews, clips, and manually curated progress.",
    },
    nextMatch,
    latestResult,
    featuredClip,
    stats,
    announcements: announcements.slice(0, 3),
  };
}

export function getAuditEvents(limit = 10) {
  return getContentDb()
    .prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?")
    .all(clampLimit(limit))
    .map((row) => rowToAuditEvent(row as DbRow));
}

export function getControlContent(type: ControlContentType = "summary", limit = 8) {
  const safeLimit = clampLimit(limit);
  const players = getPlayers();
  const members = getMembers();
  const matches = getMatches();
  const clips = getClips();
  const announcements = getAnnouncements();
  const auditEvents = getAuditEvents(safeLimit);
  const counts = {
    players: players.length,
    members: members.length,
    matches: matches.length,
    clips: clips.length,
    announcements: announcements.length,
    auditEvents: auditEvents.length,
  };

  if (type === "roster") return { type, counts, members: members.slice(0, safeLimit), players };
  if (type === "matches") return { type, counts, matches: matches.slice(0, safeLimit) };
  if (type === "clips") return { type, counts, clips: clips.slice(0, safeLimit) };
  if (type === "announcements") return { type, counts, announcements: announcements.slice(0, safeLimit) };
  if (type === "audit") return { type, counts, auditEvents };

  return {
    type: "summary",
    counts,
    latest: {
      match: matches[0] ?? null,
      clip: clips[0] ?? null,
      announcement: announcements[0] ?? null,
      auditEvent: auditEvents[0] ?? null,
    },
  };
}

export function upsertRosterFromBot(payload: Record<string, unknown>) {
  const db = getContentDb();
  const timestamp = now();
  const displayName = stringValue(payload.displayName);
  const riotId = stringValue(payload.riotId);
  const id = slugId("member", displayName);
  const peak = rankPeakValue(payload.peak);
  const status = playerStatusValue(payload.status);
  const agents = stringArray(payload.agents, 3);
  const existing = db.prepare("SELECT rank FROM members WHERE id = ? OR riot_id = ?").get(id, riotId) as { rank?: number } | undefined;
  const nextRank = existing?.rank ?? nextMemberRank(db);

  db.prepare(`
    INSERT INTO members (id, rank, display_name, riot_id, peak, kda, win, matches_count, hs, acs, move, created_at, updated_at)
    VALUES (@id, @rank, @displayName, @riotId, @peak, '/', '/', '/', '/', '/', 'steady', @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      riot_id = excluded.riot_id,
      peak = excluded.peak,
      updated_at = excluded.updated_at
  `).run({ id, rank: nextRank, displayName, riotId, peak, createdAt: timestamp, updatedAt: timestamp });

  if (status === "main" || status === "sub" || status === "staff" || status === "inactive") {
    db.prepare(`
      INSERT INTO players (id, display_name, handle, role, agents_json, peak, status, bio, stats_json, socials_json, sort_order, created_at, updated_at)
      VALUES (@id, @displayName, @riotId, @role, @agents, @peak, @status, @bio, @stats, '{}', @sortOrder, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        handle = excluded.handle,
        agents_json = excluded.agents_json,
        peak = excluded.peak,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run({
      id,
      displayName,
      riotId,
      role: "Premier Core",
      agents: JSON.stringify(agents),
      peak,
      status,
      bio: "SHD Premier member.",
      stats: JSON.stringify({ hs: "/", win: "/", kda: "/" }),
      sortOrder: nextRank,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  audit("bot.roster.upsert", payload);
  return getMembers().find((member) => member.id === id) ?? null;
}

export function createMatchFromBot(payload: Record<string, unknown>) {
  const timestamp = now();
  const id = slugId("match", `${stringValue(payload.opponent)}-${stringValue(payload.startsAt)}`);
  const match: Match = {
    id,
    startsAt: stringValue(payload.startsAt),
    opponent: stringValue(payload.opponent),
    eventType: eventTypeValue(payload.eventType),
    status: "scheduled",
    result: "pending",
    score: "-",
    maps: stringArray(payload.maps),
    reviewNotes: stringValue(payload.reviewNotes),
    takeaways: stringArray(payload.takeaways, 5),
  };
  getContentDb().prepare(`
    INSERT INTO matches (id, starts_at, opponent, event_type, status, result, score, maps_json, vod_url, review_notes, mvp, takeaways_json, created_at, updated_at)
    VALUES (@id, @startsAt, @opponent, @eventType, @status, @result, @score, @maps, NULL, @reviewNotes, NULL, @takeaways, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      starts_at = excluded.starts_at,
      opponent = excluded.opponent,
      event_type = excluded.event_type,
      maps_json = excluded.maps_json,
      review_notes = excluded.review_notes,
      updated_at = excluded.updated_at
  `).run({ ...match, maps: JSON.stringify(match.maps), takeaways: JSON.stringify(match.takeaways), createdAt: timestamp, updatedAt: timestamp });
  audit("bot.match.create", payload);
  return getMatches().find((item) => item.id === id) ?? match;
}

export function updateMatchResultFromBot(id: string, payload: Record<string, unknown>) {
  const timestamp = now();
  const result = resultValue(payload.result);
  const score = stringValue(payload.score);
  const reviewNotes = stringValue(payload.reviewNotes);
  getContentDb().prepare(`
    UPDATE matches
    SET status = 'completed', result = @result, score = @score, review_notes = COALESCE(NULLIF(@reviewNotes, ''), review_notes), updated_at = @updatedAt
    WHERE id = @id
  `).run({ id, result, score, reviewNotes, updatedAt: timestamp });
  audit("bot.match.result", { id, ...payload });
  return getMatches().find((item) => item.id === id) ?? null;
}

export function updateMatchFromBot(id: string, payload: Record<string, unknown>) {
  const current = getMatches().find((match) => match.id === id);
  if (!current) return null;

  const updated = {
    startsAt: stringValue(payload.startsAt) || current.startsAt,
    opponent: stringValue(payload.opponent) || current.opponent,
    eventType: stringValue(payload.eventType) ? eventTypeValue(payload.eventType) : current.eventType,
    maps: hasValue(payload.maps) ? stringArray(payload.maps) : current.maps,
    reviewNotes: stringValue(payload.reviewNotes) || current.reviewNotes,
  };

  getContentDb().prepare(`
    UPDATE matches
    SET starts_at = @startsAt,
        opponent = @opponent,
        event_type = @eventType,
        maps_json = @maps,
        review_notes = @reviewNotes,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    ...updated,
    maps: JSON.stringify(updated.maps),
    updatedAt: now(),
  });
  audit("bot.match.update", { id, ...payload });
  return getMatches().find((match) => match.id === id) ?? null;
}

export function createClipFromBot(payload: Record<string, unknown>) {
  const timestamp = now();
  const title = stringValue(payload.title);
  const id = slugId("clip", `${title}-${timestamp}`);
  const clip: Clip = {
    id,
    title,
    player: stringValue(payload.player),
    map: stringValue(payload.map) || "TBD",
    sourceUrl: stringValue(payload.sourceUrl),
    thumbnail: stringValue(payload.thumbnail) || "/brand/shd-logo-no-text.png",
    tags: stringArray(payload.tags, 6),
    featured: Boolean(payload.featured),
    publishedAt: new Date(timestamp).toISOString(),
  };
  getContentDb().prepare(`
    INSERT INTO clips (id, title, player, map, source_url, thumbnail, tags_json, featured, published_at, created_at, updated_at)
    VALUES (@id, @title, @player, @map, @sourceUrl, @thumbnail, @tags, @featured, @publishedAt, @createdAt, @updatedAt)
  `).run({ ...clip, tags: JSON.stringify(clip.tags), featured: clip.featured ? 1 : 0, createdAt: timestamp, updatedAt: timestamp });
  audit("bot.clip.create", payload);
  return clip;
}

export function updateClipFromBot(id: string, payload: Record<string, unknown>) {
  const current = getClips().find((clip) => clip.id === id);
  if (!current) return null;

  const updated = {
    title: stringValue(payload.title) || current.title,
    player: stringValue(payload.player) || current.player,
    map: stringValue(payload.map) || current.map,
    sourceUrl: stringValue(payload.sourceUrl) || current.sourceUrl,
    thumbnail: stringValue(payload.thumbnail) || current.thumbnail,
    tags: hasValue(payload.tags) ? stringArray(payload.tags, 6) : current.tags,
    featured: typeof payload.featured === "boolean" ? payload.featured : current.featured,
  };

  getContentDb().prepare(`
    UPDATE clips
    SET title = @title,
        player = @player,
        map = @map,
        source_url = @sourceUrl,
        thumbnail = @thumbnail,
        tags_json = @tags,
        featured = @featured,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    ...updated,
    tags: JSON.stringify(updated.tags),
    featured: updated.featured ? 1 : 0,
    updatedAt: now(),
  });
  audit("bot.clip.update", { id, ...payload });
  return getClips().find((clip) => clip.id === id) ?? null;
}

export function attachVodFromBot(payload: Record<string, unknown>) {
  const matchId = stringValue(payload.matchId);
  const vodUrl = stringValue(payload.vodUrl);
  getContentDb().prepare("UPDATE matches SET vod_url = ?, updated_at = ? WHERE id = ?").run(vodUrl, now(), matchId);
  audit("bot.vod.attach", payload);
  return getMatches().find((match) => match.id === matchId) ?? null;
}

export function createAnnouncementFromBot(payload: Record<string, unknown>) {
  const timestamp = now();
  const announcement: Announcement = {
    id: slugId("announcement", `${stringValue(payload.title)}-${timestamp}`),
    title: stringValue(payload.title),
    body: stringValue(payload.body),
    kind: announcementKindValue(payload.kind),
    publishedAt: new Date(timestamp).toISOString(),
  };
  getContentDb().prepare(`
    INSERT INTO announcements (id, title, body, kind, published_at, created_at, updated_at)
    VALUES (@id, @title, @body, @kind, @publishedAt, @createdAt, @updatedAt)
  `).run({ ...announcement, createdAt: timestamp, updatedAt: timestamp });
  audit("bot.announcement.create", payload);
  return announcement;
}

export function updateAnnouncementFromBot(id: string, payload: Record<string, unknown>) {
  const current = getAnnouncements().find((announcement) => announcement.id === id);
  if (!current) return null;

  const updated = {
    title: stringValue(payload.title) || current.title,
    body: stringValue(payload.body) || current.body,
    kind: stringValue(payload.kind) ? announcementKindValue(payload.kind) : current.kind,
  };

  getContentDb().prepare(`
    UPDATE announcements
    SET title = @title,
        body = @body,
        kind = @kind,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({ id, ...updated, updatedAt: now() });
  audit("bot.announcement.update", { id, ...payload });
  return getAnnouncements().find((announcement) => announcement.id === id) ?? null;
}

export function updatePremierRecordFromBot(payload: Record<string, unknown>) {
  const current = getStats();
  const updated = {
    ...current,
    seasonLabel: stringValue(payload.seasonLabel) || current.seasonLabel,
    wins: numberValue(payload.wins, current.wins),
    losses: numberValue(payload.losses, current.losses),
  };
  saveStats(updated);
  audit("bot.premier-record.update", payload);
  return updated;
}

export function deleteContentFromBot(type: DeleteContentType, id: string) {
  const db = getContentDb();
  let deleted = 0;

  if (type === "match") {
    deleted = db.prepare("DELETE FROM matches WHERE id = ?").run(id).changes;
  } else if (type === "clip") {
    deleted = db.prepare("DELETE FROM clips WHERE id = ?").run(id).changes;
  } else if (type === "announcement") {
    deleted = db.prepare("DELETE FROM announcements WHERE id = ?").run(id).changes;
  } else {
    const transaction = db.transaction(() => {
      const memberChanges = db.prepare("DELETE FROM members WHERE id = ?").run(id).changes;
      const playerChanges = db.prepare("DELETE FROM players WHERE id = ?").run(id).changes;
      return memberChanges + playerChanges;
    });
    deleted = transaction();
  }

  audit("bot.content.delete", { type, id, deleted });
  return { type, id, deleted, removed: deleted > 0 };
}

function saveStats(stats: SiteStats) {
  const timestamp = now();
  getContentDb().prepare(`
    INSERT INTO stat_snapshots (id, season_label, wins, losses, maps_played, round_difference, map_stats_json, agent_usage_json, player_highlights_json, created_at, updated_at)
    VALUES ('current', @seasonLabel, @wins, @losses, @mapsPlayed, @roundDifference, @mapStats, @agentUsage, @playerHighlights, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      season_label = excluded.season_label,
      wins = excluded.wins,
      losses = excluded.losses,
      maps_played = excluded.maps_played,
      round_difference = excluded.round_difference,
      map_stats_json = excluded.map_stats_json,
      agent_usage_json = excluded.agent_usage_json,
      player_highlights_json = excluded.player_highlights_json,
      updated_at = excluded.updated_at
  `).run({
    seasonLabel: stats.seasonLabel,
    wins: stats.wins,
    losses: stats.losses,
    mapsPlayed: stats.mapsPlayed,
    roundDifference: stats.roundDifference,
    mapStats: JSON.stringify(stats.mapStats),
    agentUsage: JSON.stringify(stats.agentUsage),
    playerHighlights: JSON.stringify(stats.playerHighlights),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      handle TEXT NOT NULL,
      role TEXT NOT NULL,
      agents_json TEXT NOT NULL,
      peak TEXT NOT NULL,
      status TEXT NOT NULL,
      bio TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      socials_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      rank INTEGER NOT NULL,
      display_name TEXT NOT NULL,
      riot_id TEXT NOT NULL,
      peak TEXT NOT NULL,
      kda TEXT NOT NULL,
      win TEXT NOT NULL,
      matches_count TEXT NOT NULL,
      hs TEXT NOT NULL,
      acs TEXT NOT NULL,
      move TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      starts_at TEXT NOT NULL,
      opponent TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT NOT NULL,
      score TEXT NOT NULL,
      maps_json TEXT NOT NULL,
      vod_url TEXT,
      review_notes TEXT NOT NULL,
      mvp TEXT,
      takeaways_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      player TEXT NOT NULL,
      map TEXT NOT NULL,
      source_url TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      featured INTEGER NOT NULL,
      published_at TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      published_at TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stat_snapshots (
      id TEXT PRIMARY KEY,
      season_label TEXT NOT NULL,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      maps_played INTEGER NOT NULL,
      round_difference INTEGER NOT NULL,
      map_stats_json TEXT NOT NULL,
      agent_usage_json TEXT NOT NULL,
      player_highlights_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

function seedIfEmpty(db: Db) {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM players").get() as { count: number };
  if (existing.count > 0) return;
  const timestamp = now();
  const insertPlayer = db.prepare(`
    INSERT INTO players (id, display_name, handle, role, agents_json, peak, status, bio, stats_json, socials_json, sort_order, created_at, updated_at)
    VALUES (@id, @displayName, @handle, @role, @agents, @peak, @status, @bio, @stats, @socials, @sortOrder, @createdAt, @updatedAt)
  `);
  seedPlayers.forEach((player, index) => insertPlayer.run({
    ...player,
    agents: JSON.stringify(player.agents),
    stats: JSON.stringify(player.stats),
    socials: JSON.stringify(player.socials),
    sortOrder: index + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const insertMember = db.prepare(`
    INSERT INTO members (id, rank, display_name, riot_id, peak, kda, win, matches_count, hs, acs, move, created_at, updated_at)
    VALUES (@id, @rank, @displayName, @riotId, @peak, @kda, @win, @matches, @hs, @acs, @move, @createdAt, @updatedAt)
  `);
  seedMembers.forEach((member) => insertMember.run({ ...member, createdAt: timestamp, updatedAt: timestamp }));

  const insertMatch = db.prepare(`
    INSERT INTO matches (id, starts_at, opponent, event_type, status, result, score, maps_json, vod_url, review_notes, mvp, takeaways_json, created_at, updated_at)
    VALUES (@id, @startsAt, @opponent, @eventType, @status, @result, @score, @maps, @vodUrl, @reviewNotes, @mvp, @takeaways, @createdAt, @updatedAt)
  `);
  seedMatches.forEach((match) => insertMatch.run({
    ...match,
    maps: JSON.stringify(match.maps),
    vodUrl: match.vodUrl ?? null,
    mvp: match.mvp ?? null,
    takeaways: JSON.stringify(match.takeaways),
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const insertClip = db.prepare(`
    INSERT INTO clips (id, title, player, map, source_url, thumbnail, tags_json, featured, published_at, created_at, updated_at)
    VALUES (@id, @title, @player, @map, @sourceUrl, @thumbnail, @tags, @featured, @publishedAt, @createdAt, @updatedAt)
  `);
  seedClips.forEach((clip) => insertClip.run({ ...clip, tags: JSON.stringify(clip.tags), featured: clip.featured ? 1 : 0, createdAt: timestamp, updatedAt: timestamp }));

  const insertAnnouncement = db.prepare(`
    INSERT INTO announcements (id, title, body, kind, published_at, created_at, updated_at)
    VALUES (@id, @title, @body, @kind, @publishedAt, @createdAt, @updatedAt)
  `);
  seedAnnouncements.forEach((announcement) => insertAnnouncement.run({ ...announcement, createdAt: timestamp, updatedAt: timestamp }));

  saveStats(seedStats);
}

function audit(type: string, data: unknown) {
  getContentDb().prepare("INSERT INTO audit_events (type, data_json, created_at) VALUES (?, ?, ?)").run(type, JSON.stringify(data), now());
}

function rowToPlayer(row: DbRow): Player {
  return {
    id: rowText(row, "id"),
    displayName: rowText(row, "display_name"),
    handle: rowText(row, "handle"),
    role: rowText(row, "role"),
    agents: parseJson(rowText(row, "agents_json"), []),
    peak: rowText(row, "peak") as RankPeak,
    status: rowText(row, "status") as Player["status"],
    bio: rowText(row, "bio"),
    stats: parseJson(rowText(row, "stats_json"), { hs: "/", win: "/", kda: "/" }),
    socials: parseJson(rowText(row, "socials_json"), {}),
  };
}

function rowToMember(row: DbRow): Member {
  return {
    id: rowText(row, "id"),
    rank: rowNumber(row, "rank"),
    displayName: rowText(row, "display_name"),
    riotId: rowText(row, "riot_id"),
    peak: rowText(row, "peak") as RankPeak,
    kda: rowText(row, "kda"),
    win: rowText(row, "win"),
    matches: rowText(row, "matches_count"),
    hs: rowText(row, "hs"),
    acs: rowText(row, "acs"),
    move: rowText(row, "move") as Member["move"],
  };
}

function rowToMatch(row: DbRow): Match {
  return {
    id: rowText(row, "id"),
    startsAt: rowText(row, "starts_at"),
    opponent: rowText(row, "opponent"),
    eventType: rowText(row, "event_type") as Match["eventType"],
    status: rowText(row, "status") as Match["status"],
    result: rowText(row, "result") as Match["result"],
    score: rowText(row, "score"),
    maps: parseJson(rowText(row, "maps_json"), []),
    vodUrl: rowOptionalText(row, "vod_url"),
    reviewNotes: rowText(row, "review_notes"),
    mvp: rowOptionalText(row, "mvp"),
    takeaways: parseJson(rowText(row, "takeaways_json"), []),
  };
}

function rowToClip(row: DbRow): Clip {
  return {
    id: rowText(row, "id"),
    title: rowText(row, "title"),
    player: rowText(row, "player"),
    map: rowText(row, "map"),
    sourceUrl: rowText(row, "source_url"),
    thumbnail: rowText(row, "thumbnail"),
    tags: parseJson(rowText(row, "tags_json"), []),
    featured: Boolean(row.featured),
    publishedAt: rowText(row, "published_at"),
  };
}

function rowToAnnouncement(row: DbRow): Announcement {
  return {
    id: rowText(row, "id"),
    title: rowText(row, "title"),
    body: rowText(row, "body"),
    kind: rowText(row, "kind") as Announcement["kind"],
    publishedAt: rowText(row, "published_at"),
  };
}

function rowToStats(row: DbRow): SiteStats {
  return {
    seasonLabel: rowText(row, "season_label"),
    wins: rowNumber(row, "wins"),
    losses: rowNumber(row, "losses"),
    mapsPlayed: rowNumber(row, "maps_played"),
    roundDifference: rowNumber(row, "round_difference"),
    mapStats: parseJson(rowText(row, "map_stats_json"), []),
    agentUsage: parseJson(rowText(row, "agent_usage_json"), []),
    playerHighlights: parseJson(rowText(row, "player_highlights_json"), []),
  };
}

function rowToAuditEvent(row: DbRow) {
  return {
    id: rowNumber(row, "id"),
    type: rowText(row, "type"),
    data: parseJson(rowText(row, "data_json"), {}),
    createdAt: rowNumber(row, "created_at"),
  };
}

function rowText(row: DbRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : String(value ?? "");
}

function rowOptionalText(row: DbRow, key: string) {
  const value = row[key];
  return typeof value === "string" && value ? value : undefined;
}

function rowNumber(row: DbRow, key: string) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function stringArray(value: unknown, limit = 12) {
  const items = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  return items.slice(0, limit);
}

function clampLimit(value: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 8;
  return Math.min(Math.max(Math.trunc(number), 1), 20);
}

function rankPeakValue(value: unknown): RankPeak {
  const normalized = stringValue(value).toLowerCase();
  if (
    normalized === "ascendant-1" ||
    normalized === "diamond-1" ||
    normalized === "diamond-2" ||
    normalized === "gold-1" ||
    normalized === "platinum-1" ||
    normalized === "immortal-2" ||
    normalized === "gold-3"
  ) {
    return normalized;
  }
  return "gold-1";
}

function playerStatusValue(value: unknown): Player["status"] {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "main" || normalized === "sub" || normalized === "staff" || normalized === "inactive") {
    return normalized;
  }
  return "main";
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nextMemberRank(db: Db) {
  const row = db.prepare("SELECT COALESCE(MAX(rank), 0) + 1 AS rank FROM members").get() as { rank: number };
  return row.rank;
}

function slugId(prefix: string, value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${prefix}-${slug || Date.now()}`;
}

function eventTypeValue(value: unknown): Match["eventType"] {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "scrim") return "Scrim";
  if (normalized === "tournament") return "Tournament";
  if (normalized === "showmatch") return "Showmatch";
  return "Premier";
}

function resultValue(value: unknown): Match["result"] {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "win" || normalized === "loss") return normalized;
  return "pending";
}

function announcementKindValue(value: unknown): Announcement["kind"] {
  const normalized = stringValue(value);
  if (normalized === "match" || normalized === "result" || normalized === "roster" || normalized === "clip") return normalized;
  return "site";
}
