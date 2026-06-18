import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from './config.js';
import { statements } from './db.js';
import { clientIp, ipHashes } from './privacy.js';
import { completeMinecraftLink, completeVerification } from './verification.js';
import { audit, logToChannel, minecraftLog, securityLog, staffAuditLog } from './logger.js';
import { refreshRisk } from './risk.js';
import { currentRulesVersion } from './settings.js';
import { createAdminRouter } from './admin-auth.js';

const minecraftJoinSchema = z.object({
  minecraftUuid: z.string().min(32).max(36),
  minecraftName: z.string().min(3).max(16),
  ip: z.string().min(3).optional()
});

const minecraftLinkSchema = z.object({
  code: z.string().min(4).max(32),
  minecraftUuid: z.string().min(32).max(36),
  minecraftName: z.string().min(3).max(16),
  ip: z.string().min(3).optional()
});

const gameplayRoleSnapshotSchema = z.object({
  minecraftUuid: z.string().min(32).max(36).optional(),
  playerId: z.string().min(32).max(36).optional(),
  heartsCurrent: z.number().int().min(0).max(20).nullable().optional(),
  hearts: z.number().int().min(0).max(20).optional(),
  killsTotal: z.number().int().min(0).optional(),
  kills: z.number().int().min(0).optional(),
  deathsTotal: z.number().int().min(0).optional(),
  deaths: z.number().int().min(0).optional(),
  revivalsTotal: z.number().int().min(0).optional(),
  revivals: z.number().int().min(0).optional(),
  heartGains: z.number().int().min(0).nullable().optional(),
  heartLosses: z.number().int().min(0).nullable().optional(),
  maceKills: z.number().int().min(0).nullable().optional(),
  uniqueKills: z.number().int().min(0).nullable().optional(),
  currentKillstreak: z.number().int().min(0).nullable().optional(),
  highestKillstreak: z.number().int().min(0).nullable().optional(),
  maceOneKills: z.number().int().min(0).nullable().optional(),
  maceTwoKills: z.number().int().min(0).nullable().optional(),
  maceIdentity: z.string().max(20).optional(),
  dragonEggGlowExpiresAt: z.string().max(80).optional(),
  dragonEggGlowRemainingSeconds: z.number().int().min(0).nullable().optional(),
  playtimeSeconds: z.number().int().min(0).optional(),
  eliminated: z.boolean().default(false),
  twentyHearts: z.boolean().default(false),
  dragonEggHolder: z.boolean().default(false),
  maceWielder: z.boolean().default(false)
}).refine((value) => value.minecraftUuid || value.playerId, {
  message: 'minecraftUuid or playerId is required'
});

const gameplayRoleSyncSchema = z.object({
  schemaVersion: z.number().int().min(1).optional(),
  source: z.string().min(1).max(80).optional(),
  sentAt: z.string().min(1).max(80).optional(),
  players: z.array(gameplayRoleSnapshotSchema).max(500),
  status: z.object({
    onlinePlayers: z.number().int().min(0).optional(),
    maxPlayers: z.number().int().min(0).optional(),
    grace: z.object({
      active: z.boolean().default(false),
      paused: z.boolean().default(false),
      remainingSeconds: z.number().int().min(0).optional()
    }).optional()
  }).optional()
});

const minecraftEventSchema = z.object({
  type: z.string().min(3).max(80),
  minecraftUuid: z.string().min(32).max(36).optional(),
  minecraftName: z.string().min(1).max(32).optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  message: z.string().min(1).max(1000),
  data: z.record(z.unknown()).optional()
});

const supportRulesAckSchema = z.object({
  project: z.enum(['lifesteal']).default('lifesteal')
});

const supportLifestealSignupSchema = z.object({
  rulesCode: z.string().min(8).max(40),
  discordUsername: z.string().min(2).max(80),
  discordId: z.string().min(5).max(32).optional().nullable(),
  minecraftName: z.string().min(3).max(16),
  age: z.string().max(20).optional().nullable(),
  region: z.string().min(1).max(80),
  timezone: z.string().max(80).optional().nullable(),
  foundLifesteal: z.string().min(2).max(1000),
  experience: z.string().min(10).max(2000),
  motivation: z.string().min(10).max(2000),
  team: z.string().max(1000).optional().nullable(),
  content: z.string().max(2000).optional().nullable()
});

const supportBanAppealSchema = z.object({
  discordUsername: z.string().min(2).max(80),
  minecraftName: z.string().min(3).max(16),
  banId: z.string().min(2).max(80),
  punishmentType: z.string().min(2).max(80),
  punishmentDate: z.string().max(80).optional().nullable(),
  punishmentReason: z.string().min(2).max(2000),
  context: z.string().min(10).max(4000),
  change: z.string().min(10).max(4000),
  evidence: z.string().max(4000).optional().nullable()
});

const supportPlayerReportSchema = z.object({
  discordUsername: z.string().min(2).max(80),
  minecraftName: z.string().min(3).max(16),
  reportedPlayer: z.string().min(2).max(80),
  category: z.string().min(2).max(100),
  incidentTime: z.string().min(2).max(120),
  location: z.string().max(200).optional().nullable(),
  description: z.string().min(10).max(4000),
  evidence: z.string().min(2).max(4000),
  witnesses: z.string().max(1000).optional().nullable(),
  extra: z.string().max(2000).optional().nullable()
});

const supportMinecraftRequestSchema = z.object({
  discordUsername: z.string().min(2).max(80),
  minecraftName: z.string().min(3).max(16).optional().nullable(),
  category: z.string().min(2).max(100),
  summary: z.string().min(5).max(200),
  details: z.string().min(10).max(4000),
  error: z.string().max(2000).optional().nullable(),
  evidence: z.string().max(4000).optional().nullable()
});

const publicEventTypes = new Set([
  'kill',
  'elimination',
  'revival',
  'dragon_egg',
  'mace',
  'event'
]);

const publicSchemaVersion = 3;
const verificationFaviconPath = join(process.cwd(), '..', 'reference-website', 'public', 'heart.png');
const publicSeason = {
  id: 'season-1',
  name: 'Season 1',
  starting_hearts: 10,
  max_hearts: 20
};
const supportRulesAckLifetimeMs = 24 * 60 * 60 * 1000;

const gameplayRoleMappings = [
  ['twentyHearts', 'twentyHearts'],
  ['dragonEggHolder', 'dragonEgg'],
  ['maceWielder', 'mace'],
  ['eliminated', 'eliminated']
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function validationErrorMessage(error) {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${supportFieldLabel(issue.path?.[0])}: ${issue.message}`)
      .join(' ');
  }
  return error.message;
}

function apiErrorStatus(error) {
  if (error instanceof z.ZodError) return 400;
  if (error?.type === 'entity.parse.failed') return 400;
  return Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
}

function apiErrorMessage(error, status) {
  if (error instanceof z.ZodError) return validationErrorMessage(error);
  if (error?.type === 'entity.parse.failed') return 'Invalid JSON body.';
  if (status >= 500) return 'Internal server error.';
  return error?.message || 'Request failed.';
}

function supportFieldLabel(field) {
  const labels = {
    foundLifesteal: 'How did you find Lifesteal',
    experience: 'Lifesteal or SMP experience',
    motivation: 'Why do you want to join',
    rulesCode: 'Rules acknowledgement key',
    discordUsername: 'Discord username',
    minecraftName: 'Minecraft Java name',
    region: 'Region',
    banId: 'Ban or case ID',
    punishmentType: 'Punishment type',
    punishmentReason: 'Reason shown to you',
    context: 'What happened',
    change: 'Why staff should reconsider',
    reportedPlayer: 'Reported player',
    category: 'Category',
    incidentTime: 'Incident date and time',
    description: 'Incident description',
    evidence: 'Evidence',
    summary: 'Short summary',
    details: 'Issue details'
  };
  return labels[field] ?? String(field ?? 'Field');
}

function supportError(res, status, code, error, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    error,
    ...extra
  });
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" href="/favicon.png">
  <title>${escapeHtml(title)} | SHD Lifesteal</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #101418; color: #f7faf8; }
    main { max-width: 620px; margin: 12vh auto; padding: 32px; }
    h1 { font-size: 28px; margin: 0 0 12px; }
    p { line-height: 1.55; color: #cbd5d1; }
    button, a.button { display: inline-block; border: 0; border-radius: 6px; padding: 12px 16px; background: #35b87f; color: #07100c; font-weight: 700; text-decoration: none; cursor: pointer; }
    .muted { color: #96a39d; font-size: 14px; }
    .warn { color: #ffd27a; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function bearerToken(req) {
  const header = String(req.headers.authorization ?? '').trim();
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? '';
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''));
  const rightBuffer = Buffer.from(String(right ?? ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireApiSecret(req, res, next) {
  if (!config.apiSharedSecret) return res.status(503).json({ ok: false, error: 'API_SHARED_SECRET is not configured' });
  if (!timingSafeEqualText(bearerToken(req), config.apiSharedSecret)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

function requireOverlayToken(req, res, next) {
  if (!config.overlay.publicToken) return next();
  const queryToken = req.query.token ?? '';
  if (
    timingSafeEqualText(bearerToken(req), config.overlay.publicToken) ||
    timingSafeEqualText(queryToken, config.overlay.publicToken)
  ) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function setPublicCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function publicCors(req, res, next) {
  setPublicCors(res);
  if (req.method === 'GET') {
    res.set('Cache-Control', 'no-store, max-age=0');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

const rateLimitBuckets = new Map();

function createRateLimit({ name, windowMs, max, key = defaultRateLimitKey }) {
  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();

    const now = Date.now();
    const bucketKey = `${name}:${key(req)}`;
    const bucket = rateLimitBuckets.get(bucketKey);
    if (!bucket || now >= bucket.resetAt) {
      rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count <= max) return next();

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (req.path.startsWith('/verify/')) {
      return res.status(429).send(page('Too many requests', `
        <h1>Too many requests</h1>
        <p>Please wait a moment, then try again.</p>
      `));
    }

    return res.status(429).json({ ok: false, error: 'Too many requests. Please wait a moment and try again.' });
  };
}

function defaultRateLimitKey(req) {
  return clientIp(req);
}

function protectedRateLimitKey(req) {
  const token = bearerToken(req);
  const authHash = token
    ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 16)
    : 'no-auth';
  return `${clientIp(req)}:${authHash}`;
}

const publicReadRateLimit = createRateLimit({ name: 'public-read', windowMs: 60_000, max: 240 });
const publicWriteRateLimit = createRateLimit({ name: 'public-write', windowMs: 60_000, max: 12 });
const verificationRateLimit = createRateLimit({ name: 'verification', windowMs: 15 * 60_000, max: 30 });
const protectedApiRateLimit = createRateLimit({ name: 'protected-api', windowMs: 60_000, max: 180, key: protectedRateLimitKey });

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (now >= bucket.resetAt) rateLimitBuckets.delete(key);
  }
}, 5 * 60_000).unref?.();

function normalizeSupportCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

function randomCode(prefix) {
  const value = crypto.randomBytes(4).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return `${prefix}-${value}`;
}

function createUniqueCode(prefix, finder) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomCode(prefix);
    if (!finder.get(code)) return code;
  }
  throw new Error('Could not create a unique support code.');
}

function supportApplicationStaffFields(application, extra = []) {
  return [
    { name: 'Application', value: `#${application.id} / ${application.code}`, inline: true },
    { name: 'Status', value: application.status, inline: true },
    { name: 'Discord', value: application.discord_id_verified ? `<@${application.discord_id_verified}>` : application.discord_username, inline: true },
    { name: 'Minecraft', value: application.minecraft_name, inline: true },
    { name: 'Rules', value: `${application.rules_version} / ${application.rules_code}`, inline: true },
    ...extra,
    { name: 'Found Lifesteal', value: application.answers.foundLifesteal },
    { name: 'Experience', value: application.answers.experience },
    { name: 'Motivation', value: application.answers.motivation },
    application.answers.team ? { name: 'Team', value: application.answers.team } : null,
    application.answers.content ? { name: 'Extra', value: application.answers.content } : null
  ].filter(Boolean);
}

function supportSubmissionStaffFields(submission, extra = []) {
  return [
    { name: 'Reference', value: `#${submission.id} / ${submission.code}`, inline: true },
    { name: 'Type', value: submission.form_type, inline: true },
    { name: 'Status', value: submission.status, inline: true },
    { name: 'Discord', value: submission.discord_username, inline: true },
    submission.minecraft_name ? { name: 'Minecraft', value: submission.minecraft_name, inline: true } : null,
    submission.subject_name ? { name: 'Subject', value: submission.subject_name, inline: true } : null,
    { name: 'Category', value: submission.category, inline: true },
    { name: 'Summary', value: submission.summary },
    ...extra
  ].filter(Boolean);
}

async function createPublicSupportSubmission(client, res, {
  prefix,
  formType,
  title,
  body,
  discordUsername,
  minecraftName = null,
  subjectName = null,
  category,
  summary,
  answers,
  requiresTicket,
  logChannelId
}) {
  const existing = formType === 'player_report' ? null : statements.findOpenSupportSubmission.get({
    formType,
    discordUsername,
    minecraftName,
    subjectName
  });
  if (existing) {
    return supportError(res, 409, 'SUBMISSION_ALREADY_OPEN', 'An open submission of this type already exists for this account.', {
      referenceCode: existing.code,
      submissionStatus: existing.status
    });
  }

  const submission = statements.createSupportSubmission.run({
    code: createUniqueCode(prefix, statements.findSupportSubmissionByCode),
    project: 'lifesteal',
    game: 'minecraft',
    formType,
    discordUsername: discordUsername.trim(),
    minecraftName: minecraftName?.trim() || null,
    subjectName: subjectName?.trim() || null,
    category: category.trim(),
    summary: summary.trim(),
    answers,
    requiresTicket,
    createdAt: Date.now()
  });
  audit('support.submission_created', {
    data: {
      submissionId: submission.id,
      referenceCode: submission.code,
      formType: submission.form_type,
      requiresTicket: submission.requires_ticket
    }
  });
  await logToChannel(client, logChannelId || config.supportApplicationLogChannelId || config.modLogChannelId, title, supportSubmissionStaffFields(submission, [
    { name: 'Routing', value: requiresTicket ? 'Applicant should open a Discord ticket and provide this reference.' : 'Private staff review; no public ticket required.' },
    ...body
  ]));
  return res.status(201).json({
    ok: true,
    submissionId: submission.id,
    referenceCode: submission.code,
    status: submission.status,
    requiresTicket: submission.requires_ticket
  });
}

function minecraftUuidVariants(value) {
  if (!value) return [];
  const clean = String(value).toLowerCase();
  const compact = clean.replaceAll('-', '');
  return [...new Set([clean, compact])];
}

function configuredPrestigeBadges(minecraftUuid) {
  for (const uuid of minecraftUuidVariants(minecraftUuid)) {
    const badges = config.publicPrestigeBadges.get(uuid);
    if (badges) return badges;
  }
  return [];
}

const staffPrestigeBadges = new Set(['owner', 'admin', 'mod', 'shd-team']);

function linkedRolePrestigeBadges(linked) {
  const role = String(linked?.role ?? 'player').trim().toLowerCase().replaceAll('_', '-');
  return staffPrestigeBadges.has(role) ? [role] : [];
}

function linkedPrestigeBadges(linked) {
  if (linked?.role_managed_at) return linkedRolePrestigeBadges(linked);
  return [...new Set([...configuredPrestigeBadges(linked?.minecraft_uuid), ...linkedRolePrestigeBadges(linked)])];
}

function rosterPrestigeBadges(playerPrestige, linked) {
  if (!linked) return playerPrestige ?? [];
  const basePrestige = linked.role_managed_at
    ? (playerPrestige ?? []).filter((badge) => !staffPrestigeBadges.has(badge))
    : (playerPrestige ?? []);
  return [...new Set([...basePrestige, ...linkedPrestigeBadges(linked)])];
}

function publicRosterStatusFromLinked(linked) {
  if (!linked) return null;
  if (linked.status === 'active' && linked.public_stats_opt_in) return 'Whitelisted';
  if (linked.status === 'active') return 'Registered';
  if (linked.status === 'review') return 'Review';
  if (linked.status === 'banned') return 'Banned';
  if (linked.status === 'denied') return 'Denied';
  return null;
}

function findLinkedMinecraftAccount(minecraftUuid) {
  for (const uuid of minecraftUuidVariants(minecraftUuid)) {
    const linked = statements.findLinkedByMinecraft.get(uuid);
    if (linked) return linked;
  }
  return null;
}

function findPendingManualMinecraftAccount(minecraftName) {
  const normalizedName = String(minecraftName ?? '').trim().toLowerCase();
  if (!normalizedName) return null;
  return (statements.snapshot.get().linked_accounts ?? []).find((linked) =>
    linked.status === 'active' &&
    String(linked.minecraft_uuid ?? '').startsWith('manual:') &&
    String(linked.minecraft_name ?? '').trim().toLowerCase() === normalizedName
  ) ?? null;
}

function publicMinecraftUuid(value) {
  const uuid = String(value ?? '').trim();
  return !uuid || uuid.startsWith('manual:') ? null : uuid;
}

function sameMinecraftUuid(left, right) {
  if (!left || !right) return false;
  const wanted = new Set(minecraftUuidVariants(left));
  return minecraftUuidVariants(right).some((uuid) => wanted.has(uuid));
}

function formatPlaytime(seconds) {
  if (seconds == null) return 'Hidden';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function snapshotAgeSeconds(updatedAt) {
  if (!updatedAt) return null;
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
}

function fieldStatus(value, available = true) {
  return available && value != null ? 'synced' : 'unavailable';
}

function normalizeMaceIdentity(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return ['M1', 'M2'].includes(normalized) ? normalized : null;
}

function normalizeIsoDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function publicStatusFromSync(status, updatedAt) {
  return {
    online_players: status?.onlinePlayers ?? null,
    max_players: status?.maxPlayers ?? null,
    grace_active: Boolean(status?.grace?.active),
    grace_paused: Boolean(status?.grace?.paused),
    grace_remaining_seconds: status?.grace?.remainingSeconds ?? null,
    source_updated_at: updatedAt,
    snapshot_age_seconds: 0,
    updated_at: updatedAt
  };
}

function publicPlayersFromSnapshots(snapshots, updatedAt) {
  const projected = [];

  for (const snapshot of snapshots) {
    const minecraftUuid = snapshot.minecraftUuid ?? snapshot.playerId;
    const linked = findLinkedMinecraftAccount(minecraftUuid);
    if (!linked || linked.status !== 'active' || !linked.public_stats_opt_in) {
      continue;
    }

    const prestige = linkedPrestigeBadges(linked);
    if (snapshot.dragonEggHolder) prestige.push('dragon-egg');
    const maceIdentity = normalizeMaceIdentity(snapshot.maceIdentity);
    if (snapshot.maceWielder) prestige.push(maceIdentity === 'M2' ? 'mace-2' : 'mace-1');

    const hearts = snapshot.eliminated ? 0 : snapshot.heartsCurrent ?? snapshot.hearts ?? null;
    const heartGains = snapshot.heartGains ?? null;
    const heartLosses = snapshot.heartLosses ?? null;
    const kills = snapshot.killsTotal ?? snapshot.kills ?? 0;
    const deaths = snapshot.deathsTotal ?? snapshot.deaths ?? 0;
    const revivals = snapshot.revivalsTotal ?? snapshot.revivals ?? 0;
    const maceKills = snapshot.maceKills ?? null;
    const uniqueKills = snapshot.uniqueKills ?? null;
    const currentKillstreak = snapshot.currentKillstreak ?? null;
    const highestKillstreak = snapshot.highestKillstreak ?? null;
    const maceOneKills = snapshot.maceOneKills ?? null;
    const maceTwoKills = snapshot.maceTwoKills ?? null;
    const publicPlayer = {
      minecraft_uuid: linked.minecraft_uuid,
      name: linked.minecraft_name ?? 'Unknown',
      hearts_current: hearts,
      heart_gains: heartGains,
      heart_losses: heartLosses,
      kills_total: kills,
      deaths_total: deaths,
      revivals_total: revivals,
      mace_kills: maceKills,
      unique_kills: uniqueKills,
      current_killstreak: currentKillstreak,
      highest_killstreak: highestKillstreak,
      mace_1_kills: maceOneKills,
      mace_2_kills: maceTwoKills,
      mace_identity: maceIdentity,
      playtime_seconds: snapshot.playtimeSeconds ?? null,
      playtime: formatPlaytime(snapshot.playtimeSeconds),
      eliminated: snapshot.eliminated,
      twenty_hearts: snapshot.twentyHearts,
      dragon_egg_holder: snapshot.dragonEggHolder,
      dragon_egg_glow_expires_at: normalizeIsoDate(snapshot.dragonEggGlowExpiresAt),
      dragon_egg_glow_remaining_seconds: snapshot.dragonEggGlowRemainingSeconds ?? null,
      mace_wielder: snapshot.maceWielder,
      prestige: [...new Set(prestige)],
      status: snapshot.eliminated
        ? 'Eliminated'
        : hearts === 1
          ? 'On Last Heart'
          : snapshot.twentyHearts
            ? 'Most Feared'
            : null,
      data_status: {
        hearts_current: fieldStatus(hearts),
        heart_gains: fieldStatus(heartGains),
        heart_losses: fieldStatus(heartLosses),
        kills_total: fieldStatus(kills),
        deaths_total: fieldStatus(deaths),
        revivals_total: fieldStatus(revivals),
        mace_kills: fieldStatus(maceKills),
        unique_kills: fieldStatus(uniqueKills),
        current_killstreak: fieldStatus(currentKillstreak),
        highest_killstreak: fieldStatus(highestKillstreak),
        mace_1_kills: fieldStatus(maceOneKills),
        mace_2_kills: fieldStatus(maceTwoKills),
        playtime: snapshot.playtimeSeconds == null ? 'unavailable' : 'synced',
        objectives: 'synced'
      },
      source_updated_at: updatedAt,
      // Legacy aliases for the first website integration pass.
      hearts,
      hearts_gained: heartGains,
      hearts_lost: heartLosses,
      kills,
      deaths,
      revivals,
      updated_at: updatedAt
    };

    projected.push(publicPlayer);
  }

  return projected
    .sort((first, second) =>
      Number(second.hearts_current ?? 0) - Number(first.hearts_current ?? 0) ||
      Number(second.kills_total ?? 0) - Number(first.kills_total ?? 0) ||
      first.name.localeCompare(second.name)
    )
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

function publicPlayersWithApplications(snapshot) {
  const rosterPlayers = snapshot.players.flatMap((player) => {
    const linked = findLinkedMinecraftAccount(player.minecraft_uuid);
    if (linked && linked.status !== 'active') return [];
    const rosterUpdatedAt = linked?.roster_status_updated_at ?? linked?.verified_at ?? player.source_updated_at ?? player.updated_at;
    const prestige = rosterPrestigeBadges(player.prestige, linked);
    const status = publicRosterStatusFromLinked(linked) ?? player.status;
    return [{
      ...player,
      prestige,
      status,
      source_updated_at: rosterUpdatedAt,
      updated_at: rosterUpdatedAt
    }];
  });
  const existingNames = new Set(rosterPlayers.map((player) => String(player.name ?? '').toLowerCase()));
  const existingUuids = new Set(rosterPlayers.flatMap((player) => minecraftUuidVariants(player.minecraft_uuid)));
  const linkedPlayers = statements.findLinkedAccounts.all()
    .filter((linked) => linked.status === 'active')
    .filter((linked) => !existingNames.has(String(linked.minecraft_name ?? '').toLowerCase()))
    .filter((linked) => !minecraftUuidVariants(linked.minecraft_uuid).some((uuid) => existingUuids.has(uuid)))
    .map((linked) => {
      const prestige = linkedPrestigeBadges(linked);
      existingNames.add(String(linked.minecraft_name ?? '').toLowerCase());
      minecraftUuidVariants(linked.minecraft_uuid).forEach((uuid) => existingUuids.add(uuid));

      return {
        minecraft_uuid: publicMinecraftUuid(linked.minecraft_uuid),
        name: linked.minecraft_name ?? 'Unknown',
        hearts_current: null,
        heart_gains: null,
        heart_losses: null,
        kills_total: 0,
        deaths_total: 0,
        revivals_total: 0,
        mace_kills: null,
        unique_kills: null,
        current_killstreak: null,
        highest_killstreak: null,
        mace_1_kills: null,
        mace_2_kills: null,
        mace_identity: null,
        playtime_seconds: null,
        playtime: 'Hidden',
        eliminated: false,
        twenty_hearts: false,
        dragon_egg_holder: false,
        dragon_egg_glow_expires_at: null,
        dragon_egg_glow_remaining_seconds: null,
        mace_wielder: false,
        prestige,
        status: publicRosterStatusFromLinked(linked) ?? 'Registered',
        data_status: {
          hearts_current: 'unavailable',
          heart_gains: 'unavailable',
          heart_losses: 'unavailable',
          kills_total: 'unavailable',
          deaths_total: 'unavailable',
          revivals_total: 'unavailable',
          mace_kills: 'unavailable',
          unique_kills: 'unavailable',
          current_killstreak: 'unavailable',
          highest_killstreak: 'unavailable',
          mace_1_kills: 'unavailable',
          mace_2_kills: 'unavailable',
          playtime: 'unavailable',
          objectives: 'unavailable'
        },
        source_updated_at: linked.roster_status_updated_at ?? linked.verified_at,
        hearts: null,
        hearts_gained: null,
        hearts_lost: null,
        kills: 0,
        deaths: 0,
        revivals: 0,
        updated_at: linked.roster_status_updated_at ?? linked.verified_at
      };
    });
  const appliedPlayers = statements.findPublicSupportApplications.all()
    .filter((application) => !existingNames.has(String(application.minecraft_name ?? '').toLowerCase()))
    .filter((application) => !application.minecraft_uuid || !minecraftUuidVariants(application.minecraft_uuid).some((uuid) => existingUuids.has(uuid)))
    .map((application) => ({
      minecraft_uuid: null,
      name: application.minecraft_name ?? 'Unknown',
      hearts_current: null,
      heart_gains: null,
      heart_losses: null,
      kills_total: 0,
      deaths_total: 0,
      revivals_total: 0,
      mace_kills: null,
      unique_kills: null,
      current_killstreak: null,
      highest_killstreak: null,
      mace_1_kills: null,
      mace_2_kills: null,
      mace_identity: null,
      playtime_seconds: null,
      playtime: 'Hidden',
      eliminated: false,
      twenty_hearts: false,
      dragon_egg_holder: false,
      dragon_egg_glow_expires_at: null,
      dragon_egg_glow_remaining_seconds: null,
      mace_wielder: false,
      prestige: [],
      status: 'Applied',
      data_status: {
        hearts_current: 'unavailable',
        heart_gains: 'unavailable',
        heart_losses: 'unavailable',
        kills_total: 'unavailable',
        deaths_total: 'unavailable',
        revivals_total: 'unavailable',
        mace_kills: 'unavailable',
        unique_kills: 'unavailable',
        current_killstreak: 'unavailable',
        highest_killstreak: 'unavailable',
        mace_1_kills: 'unavailable',
        mace_2_kills: 'unavailable',
        playtime: 'unavailable',
        objectives: 'unavailable'
      },
      source_updated_at: application.created_at,
      hearts: null,
      hearts_gained: null,
      hearts_lost: null,
      kills: 0,
      deaths: 0,
      revivals: 0,
      updated_at: application.created_at
    }));

  function publicRosterStatusRank(player) {
    if (player.status === 'Applied') return 2;
    if (player.status === 'Registered') return 1;
    return 0;
  }

  return [...rosterPlayers, ...linkedPlayers, ...appliedPlayers]
    .sort((first, second) =>
      publicRosterStatusRank(first) - publicRosterStatusRank(second) ||
      Number(second.hearts_current ?? 0) - Number(first.hearts_current ?? 0) ||
      Number(second.kills_total ?? 0) - Number(first.kills_total ?? 0) ||
      first.name.localeCompare(second.name)
    )
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

function publicPlayerPublishStats(snapshots, publishedCount) {
  const stats = {
    snapshots: snapshots.length,
    matchedLinked: 0,
    activeLinked: 0,
    optedIn: 0,
    unmatched: 0,
    inactive: 0,
    notOptedIn: 0,
    published: publishedCount
  };

  for (const snapshot of snapshots) {
    const minecraftUuid = snapshot.minecraftUuid ?? snapshot.playerId;
    const linked = findLinkedMinecraftAccount(minecraftUuid);
    if (!linked) {
      stats.unmatched += 1;
      continue;
    }

    stats.matchedLinked += 1;
    if (linked.status !== 'active') {
      stats.inactive += 1;
      continue;
    }

    stats.activeLinked += 1;
    if (!linked.public_stats_opt_in) {
      stats.notOptedIn += 1;
      continue;
    }

    stats.optedIn += 1;
  }

  return stats;
}

function publicObjectivesFromPlayers(players, updatedAt) {
  const dragonEggHolder = players.find((player) => player.dragon_egg_holder);
  const maceWielders = players.filter((player) => player.mace_wielder);
  const twentyHeartPlayers = players.filter((player) => Number(player.hearts_current ?? player.hearts ?? 0) >= publicSeason.max_hearts);

  return {
    dragon_egg: {
      id: 'dragon_egg',
      title: 'Dragon Egg',
      owner: dragonEggHolder?.name ?? null,
      owner_minecraft_uuid: dragonEggHolder?.minecraft_uuid ?? null,
      state: dragonEggHolder ? 'held' : 'unclaimed',
      glow_expires_at: dragonEggHolder?.dragon_egg_glow_expires_at ?? null,
      glow_remaining_seconds: dragonEggHolder?.dragon_egg_glow_remaining_seconds ?? null,
      data_status: 'synced',
      source_updated_at: updatedAt,
      updated_at: updatedAt
    },
    maces: ['M1', 'M2'].map((identity, index) => {
      const holder = maceWielders.find((player) => player.mace_identity === identity) ?? null;
      return {
        id: `mace_${index + 1}`,
        title: identity === 'M2' ? 'Mace Two' : 'Mace One',
        owner: holder?.name ?? null,
        owner_minecraft_uuid: holder?.minecraft_uuid ?? null,
        state: holder ? 'held' : 'unclaimed',
        mace_identity: identity,
        mace_identity_status: holder ? 'synced' : 'unavailable',
        mace_kills: holder?.mace_kills ?? null,
        mace_specific_kills: identity === 'M2' ? holder?.mace_2_kills ?? null : holder?.mace_1_kills ?? null,
        data_status: {
          holder: holder ? 'synced' : 'unavailable',
          mace_identity: holder ? 'synced' : 'unavailable',
          mace_kills: fieldStatus(holder?.mace_kills),
          mace_specific_kills: fieldStatus(identity === 'M2' ? holder?.mace_2_kills : holder?.mace_1_kills)
        },
        source_updated_at: updatedAt,
        updated_at: updatedAt
      };
    }),
    twenty_hearts: {
      id: 'twenty_hearts',
      title: '20 Hearts',
      count: twentyHeartPlayers.length,
      player_names: twentyHeartPlayers.map((player) => player.name),
      data_status: 'synced',
      source_updated_at: updatedAt,
      updated_at: updatedAt
    }
  };
}

function normalizePublicPlayer(player, fallbackUpdatedAt) {
  const updatedAt = player.source_updated_at ?? player.updated_at ?? fallbackUpdatedAt ?? null;
  const hearts = player.hearts_current ?? player.hearts ?? null;
  const heartGains = player.heart_gains ?? player.hearts_gained ?? null;
  const heartLosses = player.heart_losses ?? player.hearts_lost ?? null;
  const kills = player.kills_total ?? player.kills ?? 0;
  const deaths = player.deaths_total ?? player.deaths ?? 0;
  const revivals = player.revivals_total ?? player.revivals ?? 0;
  const maceKills = player.mace_kills ?? null;
  const uniqueKills = player.unique_kills ?? null;
  const currentKillstreak = player.current_killstreak ?? null;
  const highestKillstreak = player.highest_killstreak ?? null;
  const maceOneKills = player.mace_1_kills ?? null;
  const maceTwoKills = player.mace_2_kills ?? null;
  const maceIdentity = normalizeMaceIdentity(player.mace_identity);
  const playtimeSeconds = player.playtime_seconds ?? null;
  const dragonEggGlowExpiresAt = normalizeIsoDate(player.dragon_egg_glow_expires_at);

  return {
    ...player,
    hearts_current: hearts,
    heart_gains: heartGains,
    heart_losses: heartLosses,
    kills_total: kills,
    deaths_total: deaths,
    revivals_total: revivals,
    mace_kills: maceKills,
    unique_kills: uniqueKills,
    current_killstreak: currentKillstreak,
    highest_killstreak: highestKillstreak,
    mace_1_kills: maceOneKills,
    mace_2_kills: maceTwoKills,
    mace_identity: maceIdentity,
    playtime_seconds: playtimeSeconds,
    dragon_egg_glow_expires_at: dragonEggGlowExpiresAt,
    dragon_egg_glow_remaining_seconds: player.dragon_egg_glow_remaining_seconds ?? null,
    data_status: {
      hearts_current: fieldStatus(hearts),
      heart_gains: fieldStatus(heartGains),
      heart_losses: fieldStatus(heartLosses),
      kills_total: fieldStatus(kills),
      deaths_total: fieldStatus(deaths),
      revivals_total: fieldStatus(revivals),
      mace_kills: fieldStatus(maceKills),
      unique_kills: fieldStatus(uniqueKills),
      current_killstreak: fieldStatus(currentKillstreak),
      highest_killstreak: fieldStatus(highestKillstreak),
      mace_1_kills: fieldStatus(maceOneKills),
      mace_2_kills: fieldStatus(maceTwoKills),
      playtime: playtimeSeconds == null && (!player.playtime || player.playtime === 'Hidden') ? 'unavailable' : 'synced',
      objectives: 'synced',
      ...(player.data_status ?? {})
    },
    source_updated_at: updatedAt,
    // Legacy aliases for older consumers.
    hearts,
    hearts_gained: heartGains,
    hearts_lost: heartLosses,
    kills,
    deaths,
    revivals,
    updated_at: player.updated_at ?? updatedAt
  };
}

function normalizePublicSnapshot(snapshot) {
  const updatedAt = snapshot?.updated_at ?? null;
  const players = (snapshot?.players ?? []).map((player) => normalizePublicPlayer(player, updatedAt));
  const status = {
    online_players: snapshot?.status?.online_players ?? null,
    max_players: snapshot?.status?.max_players ?? null,
    grace_active: Boolean(snapshot?.status?.grace_active),
    grace_paused: Boolean(snapshot?.status?.grace_paused),
    grace_remaining_seconds: snapshot?.status?.grace_remaining_seconds ?? null,
    source_updated_at: snapshot?.status?.source_updated_at ?? snapshot?.status?.updated_at ?? updatedAt,
    snapshot_age_seconds: snapshotAgeSeconds(updatedAt),
    updated_at: snapshot?.status?.updated_at ?? updatedAt
  };

  return {
    schema_version: snapshot?.schema_version ?? publicSchemaVersion,
    status,
    players,
    objectives: snapshot?.objectives ?? publicObjectivesFromPlayers(players, updatedAt),
    season: snapshot?.season ?? publicSeason,
    updated_at: updatedAt,
    snapshot_age_seconds: snapshotAgeSeconds(updatedAt)
  };
}

function latestGameplaySyncAudit() {
  return statements.recentAudit.all(100)
    .find((row) => row.type === 'gameplay.roles_sync') ?? null;
}

function publicSyncHealth(snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get())) {
  const latestSync = latestGameplaySyncAudit();
  const latestSyncData = latestSync ? JSON.parse(latestSync.data_json ?? '{}') : {};
  const age = snapshot.snapshot_age_seconds;
  const state = age == null
    ? 'waiting'
    : age <= 45
      ? 'live'
      : age <= 180
        ? 'stale'
        : 'offline';

  return {
    state,
    fresh: state === 'live',
    stale: state === 'stale',
    waiting: state === 'waiting',
    last_sync_at: snapshot.updated_at,
    snapshot_age_seconds: age,
    players_received: latestSyncData.received ?? null,
    public_players_published: snapshot.players.length,
    public_publish: latestSyncData.publicPublish ?? null,
    source: 'shd-lifesteal',
    schema_version: snapshot.schema_version,
    latest_audit_id: latestSync?.id ?? null
  };
}

function publicPlayerByUuid(snapshot, minecraftUuid) {
  return snapshot.players.find((player) => sameMinecraftUuid(player.minecraft_uuid, minecraftUuid)) ?? null;
}

function publicPlayerByName(snapshot, name) {
  const normalized = String(name).toLowerCase();
  return snapshot.players.find((player) => player.name.toLowerCase() === normalized) ?? null;
}

function publicLeaderboard(snapshot, sort = 'hearts') {
  const sorters = {
    hearts: (first, second) => Number(second.hearts_current ?? 0) - Number(first.hearts_current ?? 0),
    kills: (first, second) => Number(second.kills_total ?? 0) - Number(first.kills_total ?? 0),
    deaths: (first, second) => Number(second.deaths_total ?? 0) - Number(first.deaths_total ?? 0),
    revivals: (first, second) => Number(second.revivals_total ?? 0) - Number(first.revivals_total ?? 0),
    unique_kills: (first, second) => Number(second.unique_kills ?? 0) - Number(first.unique_kills ?? 0),
    current_killstreak: (first, second) => Number(second.current_killstreak ?? 0) - Number(first.current_killstreak ?? 0),
    highest_killstreak: (first, second) => Number(second.highest_killstreak ?? 0) - Number(first.highest_killstreak ?? 0),
    mace_kills: (first, second) => Number(second.mace_kills ?? 0) - Number(first.mace_kills ?? 0),
    playtime: (first, second) => Number(second.playtime_seconds ?? 0) - Number(first.playtime_seconds ?? 0)
  };
  const sorter = sorters[sort] ?? sorters.hearts;

  return [...snapshot.players]
    .sort((first, second) =>
      sorter(first, second) ||
      Number(second.hearts_current ?? 0) - Number(first.hearts_current ?? 0) ||
      Number(second.kills_total ?? 0) - Number(first.kills_total ?? 0) ||
      first.name.localeCompare(second.name)
    )
    .map((player, index) => ({ ...player, rank: index + 1, leaderboard_sort: sorters[sort] ? sort : 'hearts' }));
}

function publicPlayerTimeline(player, limit = 25) {
  return statements.recentAudit.all(200)
    .filter((row) => {
      if (!row.minecraft_uuid || !sameMinecraftUuid(row.minecraft_uuid, player.minecraft_uuid)) return false;
      if (!row.type.startsWith('minecraft.event.')) return false;
      const data = JSON.parse(row.data_json ?? '{}');
      const type = row.type.replace('minecraft.event.', '');
      return data.public === true || publicEventTypes.has(type);
    })
    .slice(0, limit)
    .map((row) => {
      const data = JSON.parse(row.data_json ?? '{}');
      return {
        id: row.id,
        type: row.type.replace('minecraft.event.', ''),
        message: data.message ?? row.type,
        severity: data.severity ?? 'info',
        created_at: row.created_at
      };
    });
}

function formatRoleSyncDiagnostics(diagnostics) {
  return diagnostics
    .slice(0, 10)
    .map((item) => {
      const target = item.discordId ? `<@${item.discordId}>` : item.minecraftName || item.minecraftUuid || 'Unknown player';
      return `${item.action} ${target} role ${item.roleId}: ${item.error}`;
    })
    .join('\n')
    .slice(0, 1024) || 'No examples captured.';
}

function savePublicLifestealSnapshot(snapshots, status) {
  const updatedAt = Date.now();
  const players = publicPlayersFromSnapshots(snapshots, updatedAt);
  const publishStats = publicPlayerPublishStats(snapshots, players.length);
  const publicStatus = publicStatusFromSync(status, updatedAt);
  const objectives = publicObjectivesFromPlayers(players, updatedAt);
  statements.upsertPublicLifestealSnapshot.run({
    schemaVersion: publicSchemaVersion,
    status: publicStatus,
    players,
    objectives,
    season: publicSeason,
    updatedAt
  });
  return { status: publicStatus, players, objectives, publishStats, updatedAt };
}

function publicEvents(limit = 20) {
  const scheduledEvents = (statements.snapshot.get().lifesteal_events ?? [])
    .filter((event) => event.public && event.status !== 'draft' && event.status !== 'cancelled')
    .sort((left, right) => left.starts_at - right.starts_at || (left.priority ?? 10) - (right.priority ?? 10))
    .slice(0, limit)
    .map((event) => ({
      id: `lifesteal-event-${event.id}`,
      source: 'admin_schedule',
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at ?? null,
      type: event.type,
      reward: event.reward ?? '',
      objective: event.objective,
      summary: event.summary,
      priority: event.priority ?? 10,
      status: event.status ?? 'scheduled',
      created_at: event.created_at,
      updated_at: event.updated_at
    }));

  const auditEvents = statements.recentAudit.all(100)
    .filter((row) => row.type.startsWith('minecraft.event.'))
    .map((row) => {
      const data = JSON.parse(row.data_json ?? '{}');
      const type = row.type.replace('minecraft.event.', '');
      return { row, data, type };
    })
    .filter(({ data, type }) => data.public === true || publicEventTypes.has(type))
    .slice(0, limit)
    .map(({ row, data, type }) => ({
      id: row.id,
      type,
      severity: data.severity ?? 'info',
      message: data.message ?? type,
      minecraft_name: data.minecraftName ?? null,
      created_at: row.created_at
    }));

  return scheduledEvents.length > 0 ? scheduledEvents : auditEvents;
}

function saveOverlayLifestealPlayer(snapshots) {
  if (!config.overlay.lifestealPlayerUuid) {
    return { configured: false, saved: false };
  }

  const snapshot = snapshots.find((item) =>
    sameMinecraftUuid(config.overlay.lifestealPlayerUuid, item.minecraftUuid ?? item.playerId)
  );
  if (!snapshot) {
    return { configured: true, saved: false };
  }

  const minecraftUuid = snapshot.minecraftUuid ?? snapshot.playerId;
  const linked = findLinkedMinecraftAccount(minecraftUuid);
  statements.upsertOverlayLifestealPlayer.run({
    minecraftUuid,
    minecraftName: linked?.minecraft_name ?? null,
    hearts: snapshot.eliminated ? 0 : snapshot.heartsCurrent ?? snapshot.hearts ?? null,
    eliminated: snapshot.eliminated,
    twentyHearts: snapshot.twentyHearts,
    dragonEggHolder: snapshot.dragonEggHolder,
    maceWielder: snapshot.maceWielder,
    updatedAt: Date.now()
  });
  return { configured: true, saved: true };
}

async function syncGameplayRoles(client, snapshots) {
  const configuredRoles = gameplayRoleMappings
    .map(([snapshotKey, configKey]) => ({
      snapshotKey,
      configKey,
      roleId: config.gameplayRoleIds[configKey]
    }))
    .filter((role) => role.roleId);
  const configuredHeartRoles = Object.entries(config.gameplayRoleIds.hearts)
    .map(([hearts, roleId]) => ({ hearts: Number(hearts), roleId }))
    .filter((role) => role.roleId);
  const allManagedRoleIds = [
    ...configuredRoles.map((role) => role.roleId),
    ...configuredHeartRoles.map((role) => role.roleId)
  ];

  if (configuredRoles.length === 0 && configuredHeartRoles.length === 0) {
    return {
      configuredRoles: 0,
      received: snapshots.length,
      linked: 0,
      members: 0,
      added: 0,
      removed: 0,
      clearedMissing: 0,
      skipped: snapshots.length,
      errors: 0
    };
  }

  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) {
    throw new Error('Configured Discord guild was not found.');
  }

  const stats = {
    configuredRoles: configuredRoles.length + configuredHeartRoles.length,
    received: snapshots.length,
    linked: 0,
    members: 0,
    added: 0,
    removed: 0,
    clearedMissing: 0,
    skipped: 0,
    errors: 0
  };
  const diagnostics = [];
  const syncedDiscordIds = new Set();

  function recordRoleSyncError({ linked = null, minecraftUuid = null, minecraftName = null, roleId, action, error }) {
    stats.errors += 1;
    if (diagnostics.length >= 25) return;
    diagnostics.push({
      discordId: linked?.discord_id ?? null,
      minecraftUuid: linked?.minecraft_uuid ?? minecraftUuid ?? null,
      minecraftName: linked?.minecraft_name ?? minecraftName ?? null,
      roleId,
      action,
      error: error?.message || String(error)
    });
  }

  for (const snapshot of snapshots) {
    const minecraftUuid = snapshot.minecraftUuid ?? snapshot.playerId;
    const linked = findLinkedMinecraftAccount(minecraftUuid);
    if (!linked || linked.status !== 'active') {
      stats.skipped += 1;
      continue;
    }
    stats.linked += 1;
    syncedDiscordIds.add(linked.discord_id);

    const member = await guild.members.fetch(linked.discord_id).catch(() => null);
    if (!member) {
      stats.skipped += 1;
      continue;
    }
    stats.members += 1;

    for (const role of configuredRoles) {
      const shouldHaveRole = Boolean(snapshot[role.snapshotKey]);
      const hasRole = member.roles.cache.has(role.roleId);
      try {
        if (shouldHaveRole && !hasRole) {
          await member.roles.add(role.roleId, `Lifesteal gameplay role: ${role.configKey}`);
          stats.added += 1;
        } else if (!shouldHaveRole && hasRole) {
          await member.roles.remove(role.roleId, `Lifesteal gameplay role: ${role.configKey}`);
          stats.removed += 1;
        }
      } catch (error) {
        recordRoleSyncError({
          linked,
          minecraftUuid,
          minecraftName: snapshot.name ?? snapshot.minecraftName ?? null,
          roleId: role.roleId,
          action: shouldHaveRole ? 'add_gameplay_role' : 'remove_gameplay_role',
          error
        });
      }
    }

    if (snapshot.hearts != null) {
      for (const role of configuredHeartRoles) {
        const shouldHaveRole = Number(snapshot.hearts) === role.hearts;
        const hasRole = member.roles.cache.has(role.roleId);
        try {
          if (shouldHaveRole && !hasRole) {
            await member.roles.add(role.roleId, `Lifesteal heart role: ${role.hearts}`);
            stats.added += 1;
          } else if (!shouldHaveRole && hasRole) {
            await member.roles.remove(role.roleId, `Lifesteal heart role: ${role.hearts}`);
            stats.removed += 1;
          }
        } catch (error) {
          recordRoleSyncError({
            linked,
            minecraftUuid,
            minecraftName: snapshot.name ?? snapshot.minecraftName ?? null,
            roleId: role.roleId,
            action: shouldHaveRole ? 'add_heart_role' : 'remove_heart_role',
            error
          });
        }
      }
    }
  }

  for (const linked of statements.findLinkedAccounts.all()) {
    if (linked.status !== 'active' || syncedDiscordIds.has(linked.discord_id)) {
      continue;
    }

    const member = await guild.members.fetch(linked.discord_id).catch(() => null);
    if (!member) {
      continue;
    }

    for (const roleId of allManagedRoleIds) {
      if (!member.roles.cache.has(roleId)) {
        continue;
      }

      try {
        await member.roles.remove(roleId, 'Lifesteal gameplay role no longer present in full sync');
        stats.removed += 1;
        stats.clearedMissing += 1;
      } catch (error) {
        recordRoleSyncError({
          linked,
          roleId,
          action: 'clear_missing_role',
          error
        });
      }
    }
  }

  stats.diagnostics = diagnostics;
  return stats;
}

export function startWebServer(client) {
  const app = express();
  app.set('trust proxy', true);
  app.use('/api/v1/public', publicCors);
  app.use('/api/v1/overlays', publicCors);
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1/admin', protectedApiRateLimit, createAdminRouter(client));

  app.get('/favicon.png', (_req, res) => {
    if (!existsSync(verificationFaviconPath)) return res.sendStatus(404);
    return res.sendFile(verificationFaviconPath);
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/verify/:token', verificationRateLimit, (req, res) => {
    const token = req.params.token;
    const row = statements.getToken.get(token);
    if (!row || row.used_at || Date.now() > row.expires_at) {
      return res.status(400).send(page('Verification unavailable', `
        <h1>Verification unavailable</h1>
        <p>This link is missing, expired, or already used. Return to Discord and run <strong>/verify</strong> again.</p>
      `));
    }

    res.send(page('Finish verification', `
      <h1>Finish Lifesteal verification</h1>
      <p>You are linking Discord account <strong>${escapeHtml(row.discord_id)}</strong> to Minecraft account <strong>${escapeHtml(row.minecraft_name)}</strong>.</p>
      <p>By continuing, you accept the current Lifesteal rules version <strong>${escapeHtml(currentRulesVersion())}</strong>.</p>
      <p class="warn">This stores a protected hash of your IP address to help enforce one user per account/IP and flag suspicious duplicate signups. Staff should disclose this in server rules/privacy notices.</p>
      <form method="post" action="/verify/${escapeHtml(token)}">
        <button type="submit">I consent and verify</button>
      </form>
      <p class="muted">The raw IP is not stored by this bot; only keyed hashes are saved.</p>
    `));
  });

  app.post('/verify/:token', verificationRateLimit, async (req, res) => {
    if (config.requireVerificationConsent !== true) {
      return res.status(403).send(page('Consent required', '<h1>Consent required</h1><p>Verification consent is disabled by configuration.</p>'));
    }

    try {
      const result = await completeVerification(client, req.params.token, clientIp(req));
      const warning = result.suspicious
        ? `<p class="warn">Your account was verified, but it was flagged for staff review: ${escapeHtml(result.suspiciousReason)}</p>`
        : '';
      res.send(page('Verified', `
        <h1>Verified</h1>
        <p>Your Discord account is linked to <strong>${escapeHtml(result.minecraftName)}</strong>. You can close this tab.</p>
        ${warning}
      `));
    } catch (error) {
      res.status(400).send(page('Verification failed', `
        <h1>Verification failed</h1>
        <p>${escapeHtml(error.message)}</p>
      `));
    }
  });

  app.get('/api/v1/link/discord/:discordId', protectedApiRateLimit, requireApiSecret, (req, res) => {
    const linked = statements.findLinkedByDiscord.get(req.params.discordId);
    res.json({ linked: linked ?? null });
  });

  app.get('/api/v1/overlays/lifesteal/player', publicReadRateLimit, requireOverlayToken, (_req, res) => {
    const player = statements.getOverlayLifestealPlayer.get();
    res.json({
      ok: true,
      configured: Boolean(config.overlay.lifestealPlayerUuid),
      player
    });
  });

  app.get('/api/v1/public/status', publicReadRateLimit, (_req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      status: snapshot.status,
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/players', publicReadRateLimit, (_req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    const players = publicPlayersWithApplications(snapshot);
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      players,
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/players/by-name/:name', publicReadRateLimit, (req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    const player = publicPlayerByName({ ...snapshot, players: publicPlayersWithApplications(snapshot) }, req.params.name);
    if (!player) return res.status(404).json({ ok: false, error: 'Public player was not found.' });
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      player,
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/players/:minecraftUuid', publicReadRateLimit, (req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    const player = publicPlayerByUuid({ ...snapshot, players: publicPlayersWithApplications(snapshot) }, req.params.minecraftUuid);
    if (!player) return res.status(404).json({ ok: false, error: 'Public player was not found.' });
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      player,
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/players/:minecraftUuid/timeline', publicReadRateLimit, (req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    const player = publicPlayerByUuid({ ...snapshot, players: publicPlayersWithApplications(snapshot) }, req.params.minecraftUuid);
    if (!player) return res.status(404).json({ ok: false, error: 'Public player was not found.' });
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit ?? '25', 10) || 25));
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      player: {
        minecraft_uuid: player.minecraft_uuid,
        name: player.name
      },
      timeline: publicPlayerTimeline(player, limit),
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/leaderboard', publicReadRateLimit, (req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    const players = publicPlayersWithApplications(snapshot);
    const sort = String(req.query.sort ?? 'hearts');
    const limit = Math.max(1, Math.min(500, Number.parseInt(req.query.limit ?? '100', 10) || 100));
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      sort: ['hearts', 'kills', 'deaths', 'revivals', 'unique_kills', 'current_killstreak', 'highest_killstreak', 'mace_kills', 'playtime'].includes(sort) ? sort : 'hearts',
      players: publicLeaderboard({ ...snapshot, players }, sort).slice(0, limit),
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/objectives', publicReadRateLimit, (_req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      objectives: snapshot.objectives,
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/season', publicReadRateLimit, (_req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      season: snapshot.season,
      status: snapshot.status,
      snapshotAgeSeconds: snapshot.snapshot_age_seconds,
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/sync-health', publicReadRateLimit, (_req, res) => {
    const snapshot = normalizePublicSnapshot(statements.getPublicLifestealSnapshot.get());
    res.json({
      ok: true,
      schemaVersion: snapshot.schema_version,
      health: publicSyncHealth(snapshot),
      updatedAt: snapshot.updated_at
    });
  });

  app.get('/api/v1/public/events', publicReadRateLimit, (_req, res) => {
    res.json({
      ok: true,
      events: publicEvents(),
      updatedAt: Date.now()
    });
  });

  app.post('/api/v1/public/rules/acknowledge', publicWriteRateLimit, (req, res) => {
    try {
      const body = supportRulesAckSchema.parse(req.body ?? {});
      const now = Date.now();
      const code = createUniqueCode('SHD-RULES', statements.findSupportRuleAcknowledgementByCode);
      const ack = statements.createSupportRuleAcknowledgement.run({
        code,
        project: body.project,
        rulesVersion: currentRulesVersion(),
        createdAt: now,
        expiresAt: now + supportRulesAckLifetimeMs
      });
      audit('support.rules_ack_created', {
        data: {
          project: ack.project,
          rulesVersion: ack.rules_version,
          expiresAt: ack.expires_at
        }
      });
      res.json({
        ok: true,
        code: ack.code,
        project: ack.project,
        rulesVersion: ack.rules_version,
        expiresAt: ack.expires_at
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: validationErrorMessage(error) });
    }
  });

  app.post('/api/v1/public/support/lifesteal-signup', publicWriteRateLimit, async (req, res) => {
    try {
      const body = supportLifestealSignupSchema.parse(req.body);
      const rulesCode = normalizeSupportCode(body.rulesCode);
      const ack = statements.findSupportRuleAcknowledgementByCode.get(rulesCode);
      if (!ack) return supportError(res, 404, 'RULES_CODE_NOT_FOUND', 'Rules acknowledgement key was not found. Generate a new key on the Lifesteal rules page.');
      if (ack.project !== 'lifesteal') return supportError(res, 400, 'RULES_CODE_WRONG_PROJECT', 'This rules key belongs to a different SHD project.');
      if (ack.rules_version !== currentRulesVersion()) {
        return supportError(res, 409, 'RULES_CODE_OUTDATED', 'The rules changed after this key was generated. Read the current rules and generate a new key.', {
          submittedRulesVersion: ack.rules_version,
          currentRulesVersion: currentRulesVersion()
        });
      }
      const minecraftName = body.minecraftName.trim();
      const discordUsername = body.discordUsername.trim();
      const discordIdClaimed = body.discordId?.trim() || null;
      const linkedAccount = statements.findLinkedAccounts.all().find((linked) =>
        String(linked.minecraft_name ?? '').trim().toLowerCase() === minecraftName.toLowerCase()
      );
      if (linkedAccount) {
        return supportError(res, 409, 'MINECRAFT_ALREADY_LINKED', `${minecraftName} is already linked to a Discord account. Contact staff in Discord if this link is incorrect.`);
      }

      const existingApplication = statements.findOpenSupportApplication.get({
        minecraftName,
        discordId: discordIdClaimed,
        discordUsername
      });
      if (existingApplication) {
        return supportError(res, 409, 'APPLICATION_ALREADY_OPEN', 'An open Lifesteal application already exists for this Minecraft or Discord identity. Continue with its Discord ticket instead of submitting another application.', {
          applicationCode: existingApplication.code,
          applicationStatus: existingApplication.status
        });
      }

      if (ack.used_at) return supportError(res, 409, 'RULES_CODE_USED', 'This rules key has already been used for an application. Generate a new rules key before submitting a different application.');
      if (Date.now() > ack.expires_at) return supportError(res, 410, 'RULES_CODE_EXPIRED', 'This rules key expired. Return to the Lifesteal rules page and generate a new one.');

      const applicationCode = createUniqueCode('SHD-APP', statements.findSupportApplicationByCode);
      const application = statements.createSupportApplication.run({
        code: applicationCode,
        project: 'lifesteal',
        game: 'minecraft',
        formType: 'lifesteal_signup',
        rulesAckId: ack.id,
        rulesCode: ack.code,
        rulesVersion: ack.rules_version,
        discordUsername,
        discordIdClaimed,
        minecraftName,
        answers: {
          age: body.age?.trim() || null,
          region: body.region.trim(),
          timezone: body.timezone?.trim() || null,
          foundLifesteal: body.foundLifesteal.trim(),
          experience: body.experience.trim(),
          motivation: body.motivation.trim(),
          team: body.team?.trim() || null,
          content: body.content?.trim() || null
        },
        createdAt: Date.now()
      });
      audit('support.application_submitted', {
        data: {
          applicationId: application.id,
          applicationCode: application.code,
          project: application.project,
          game: application.game,
          formType: application.form_type
        }
      });
      await logToChannel(client, config.supportApplicationLogChannelId, 'Support Application Submitted', supportApplicationStaffFields(application, [
        { name: 'Next Step', value: 'Applicant must post the application code in their Discord ticket.' }
      ]));
      res.status(201).json({
        ok: true,
        applicationId: application.id,
        applicationCode: application.code,
        status: application.status
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: validationErrorMessage(error) });
    }
  });

  app.post('/api/v1/public/support/minecraft-ban-appeal', publicWriteRateLimit, async (req, res) => {
    try {
      const body = supportBanAppealSchema.parse(req.body);
      return createPublicSupportSubmission(client, res, {
        prefix: 'SHD-APL',
        formType: 'ban_appeal',
        title: 'Minecraft Ban Appeal Submitted',
        body: [
          { name: 'Ban / Case ID', value: body.banId, inline: true },
          { name: 'Punishment', value: body.punishmentType, inline: true },
          { name: 'Reason Shown', value: body.punishmentReason },
          { name: 'Appeal Context', value: body.context },
          { name: 'Why Reconsider', value: body.change },
          body.evidence ? { name: 'Evidence', value: body.evidence } : null
        ].filter(Boolean),
        discordUsername: body.discordUsername,
        minecraftName: body.minecraftName,
        subjectName: body.banId,
        category: body.punishmentType,
        summary: body.punishmentReason,
        answers: {
          banId: body.banId,
          punishmentDate: body.punishmentDate?.trim() || null,
          punishmentReason: body.punishmentReason.trim(),
          context: body.context.trim(),
          change: body.change.trim(),
          evidence: body.evidence?.trim() || null
        },
        requiresTicket: true,
        logChannelId: config.appealLogChannelId
      });
    } catch (error) {
      return res.status(400).json({ ok: false, error: validationErrorMessage(error) });
    }
  });

  app.post('/api/v1/public/support/minecraft-player-report', publicWriteRateLimit, async (req, res) => {
    try {
      const body = supportPlayerReportSchema.parse(req.body);
      return createPublicSupportSubmission(client, res, {
        prefix: 'SHD-RPT',
        formType: 'player_report',
        title: 'Minecraft Player Report Submitted',
        body: [
          { name: 'Incident Time', value: body.incidentTime, inline: true },
          body.location ? { name: 'Location', value: body.location, inline: true } : null,
          { name: 'Incident', value: body.description },
          { name: 'Evidence', value: body.evidence },
          body.witnesses ? { name: 'Witnesses', value: body.witnesses } : null,
          body.extra ? { name: 'Extra', value: body.extra } : null
        ].filter(Boolean),
        discordUsername: body.discordUsername,
        minecraftName: body.minecraftName,
        subjectName: body.reportedPlayer,
        category: body.category,
        summary: body.description,
        answers: {
          incidentTime: body.incidentTime.trim(),
          location: body.location?.trim() || null,
          description: body.description.trim(),
          evidence: body.evidence.trim(),
          witnesses: body.witnesses?.trim() || null,
          extra: body.extra?.trim() || null
        },
        requiresTicket: false,
        logChannelId: config.modLogChannelId
      });
    } catch (error) {
      return res.status(400).json({ ok: false, error: validationErrorMessage(error) });
    }
  });

  app.post('/api/v1/public/support/minecraft-support', publicWriteRateLimit, async (req, res) => {
    try {
      const body = supportMinecraftRequestSchema.parse(req.body);
      return createPublicSupportSubmission(client, res, {
        prefix: 'SHD-SUP',
        formType: 'minecraft_support',
        title: 'Minecraft Support Request Submitted',
        body: [
          { name: 'Details', value: body.details },
          body.error ? { name: 'Error Message', value: body.error } : null,
          body.evidence ? { name: 'Evidence', value: body.evidence } : null
        ].filter(Boolean),
        discordUsername: body.discordUsername,
        minecraftName: body.minecraftName,
        category: body.category,
        summary: body.summary,
        answers: {
          details: body.details.trim(),
          error: body.error?.trim() || null,
          evidence: body.evidence?.trim() || null
        },
        requiresTicket: true,
        logChannelId: config.ticketNotifyChannelId
      });
    } catch (error) {
      return res.status(400).json({ ok: false, error: validationErrorMessage(error) });
    }
  });

  app.post('/api/v1/minecraft/join', protectedApiRateLimit, requireApiSecret, async (req, res) => {
    const body = minecraftJoinSchema.parse(req.body);
    statements.recordMinecraftName.run({
      minecraftUuid: body.minecraftUuid,
      username: body.minecraftName,
      seenAt: Date.now()
    });
    let linked = findLinkedMinecraftAccount(body.minecraftUuid);
    if (!linked) {
      const pendingManual = findPendingManualMinecraftAccount(body.minecraftName);
      if (pendingManual) {
        try {
          linked = statements.updateLinkedMinecraftIdentity.run({
            discordId: pendingManual.discord_id,
            minecraftUuid: body.minecraftUuid,
            minecraftName: body.minecraftName,
            seenAt: Date.now()
          });
          statements.upsertRulesAcceptance.run({
            discordId: pendingManual.discord_id,
            minecraftUuid: body.minecraftUuid,
            rulesVersion: currentRulesVersion(),
            acceptedAt: Date.now(),
            source: 'admin_player_first_join'
          });
          audit('minecraft.manual_uuid_claimed', {
            discordId: pendingManual.discord_id,
            minecraftUuid: body.minecraftUuid,
            data: {
              previousMinecraftUuid: pendingManual.minecraft_uuid,
              minecraftName: body.minecraftName
            }
          });
        } catch (error) {
          audit('minecraft.manual_uuid_claim_failed', {
            discordId: pendingManual.discord_id,
            minecraftUuid: body.minecraftUuid,
            data: {
              previousMinecraftUuid: pendingManual.minecraft_uuid,
              minecraftName: body.minecraftName,
              error: error.message
            }
          });
          return res.status(409).json({ allowed: false, reason: error.message || 'Minecraft account is already linked.' });
        }
      }
    }
    if (!linked) return res.status(404).json({ allowed: false, reason: 'Minecraft account is not linked.' });
    if (linked.status !== 'active') return res.status(403).json({ allowed: false, reason: `Link status is ${linked.status}.` });

    const rules = statements.findRulesAcceptance.get(linked.discord_id);
    if (!rules || rules.rules_version !== currentRulesVersion()) {
      audit('minecraft.join_rejected', {
        discordId: linked.discord_id,
        minecraftUuid: linked.minecraft_uuid,
        data: { reason: 'rules_not_accepted', currentRulesVersion: currentRulesVersion() }
      });
      return res.status(403).json({ allowed: false, reason: `Accept rules version ${currentRulesVersion()} in Discord first.` });
    }

    const risk = await refreshRisk(client, linked);
    if (risk.score >= 80) {
      audit('minecraft.join_rejected', {
        discordId: linked.discord_id,
        minecraftUuid: linked.minecraft_uuid,
        data: { reason: 'high_risk', riskScore: risk.score, riskBand: risk.band }
      });
      return res.status(403).json({ allowed: false, reason: `Account requires staff review. Risk score ${risk.score}.` });
    }

    if (body.ip) {
      const { ipHash } = ipHashes(body.ip);
      if (linked.ip_hash && linked.ip_hash !== ipHash) {
        statements.setLinkedStatus.run({
          discordId: linked.discord_id,
          status: 'review',
          suspicious: 1,
          reason: 'Minecraft join IP does not match verification IP hash'
        });
        audit('minecraft.ip_mismatch', {
          discordId: linked.discord_id,
          minecraftUuid: linked.minecraft_uuid,
          ipHash,
          data: { minecraftName: body.minecraftName }
        });
        audit('minecraft.join_rejected', {
          discordId: linked.discord_id,
          minecraftUuid: linked.minecraft_uuid,
          ipHash,
          data: { reason: 'ip_lock_mismatch', minecraftName: body.minecraftName }
        });
        return res.status(403).json({ allowed: false, reason: 'IP lock mismatch; staff review required.' });
      }
    }

    audit('minecraft.join_allowed', {
      discordId: linked.discord_id,
      minecraftUuid: linked.minecraft_uuid,
      ipHash: body.ip ? ipHashes(body.ip).ipHash : null,
      data: { minecraftName: body.minecraftName }
    });
    await minecraftLog(client, 'Minecraft Join Allowed', [
      { name: 'Discord', value: `<@${linked.discord_id}>`, inline: true },
      { name: 'Minecraft', value: body.minecraftName, inline: true },
      { name: 'Risk', value: String(risk.score), inline: true }
    ]);
    res.json({ allowed: true, discordId: linked.discord_id, status: linked.status, riskScore: risk.score, rulesVersion: currentRulesVersion() });
  });

  app.post('/api/v1/minecraft/event', protectedApiRateLimit, requireApiSecret, async (req, res) => {
    try {
      const body = minecraftEventSchema.parse(req.body);
      const linked = body.minecraftUuid ? findLinkedMinecraftAccount(body.minecraftUuid) : null;
      audit(`minecraft.event.${body.type}`, {
        discordId: linked?.discord_id ?? null,
        minecraftUuid: body.minecraftUuid ?? linked?.minecraft_uuid ?? null,
        data: {
          minecraftName: body.minecraftName ?? linked?.minecraft_name ?? null,
          severity: body.severity,
          message: body.message,
          ...(body.data ?? {})
        }
      });

      const log = body.severity === 'info' ? minecraftLog : securityLog;
      await log(client, `Minecraft ${body.severity.toUpperCase()}: ${body.type}`, [
        { name: 'Discord', value: linked ? `<@${linked.discord_id}>` : 'Unknown', inline: true },
        { name: 'Minecraft', value: body.minecraftName ?? linked?.minecraft_name ?? 'Unknown', inline: true },
        { name: 'Message', value: body.message }
      ]);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/v1/minecraft/link', protectedApiRateLimit, requireApiSecret, async (req, res) => {
    try {
      const body = minecraftLinkSchema.parse(req.body);
      statements.recordMinecraftName.run({
        minecraftUuid: body.minecraftUuid,
        username: body.minecraftName,
        seenAt: Date.now()
      });
      const result = await completeMinecraftLink(client, body.code, body.minecraftUuid, body.minecraftName, body.ip ?? clientIp(req));
      res.json({
        ok: true,
        discordId: result.discordId,
        minecraftName: result.minecraftName,
        riskScore: result.riskScore,
        riskBand: result.riskBand,
        requiresReview: result.riskScore >= 80
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/v1/gameplay/roles/sync', protectedApiRateLimit, requireApiSecret, async (req, res) => {
    try {
      const body = gameplayRoleSyncSchema.parse(req.body);
      const overlay = saveOverlayLifestealPlayer(body.players);
      const publicSnapshot = savePublicLifestealSnapshot(body.players, body.status);
      let stats;
      try {
        stats = await syncGameplayRoles(client, body.players);
      } catch (error) {
        stats = {
          configuredRoles: 0,
          received: body.players.length,
          linked: 0,
          members: 0,
          added: 0,
          removed: 0,
          clearedMissing: 0,
          skipped: body.players.length,
          errors: body.players.length,
          roleSyncError: error.message
        };
      }
      audit('gameplay.roles_sync', { data: { ...stats, overlay, publicPlayers: publicSnapshot.players.length, publicPublish: publicSnapshot.publishStats } });
      if (stats.diagnostics?.length > 0) {
        await staffAuditLog(client, 'Gameplay Role Sync Issues', [
          { name: 'Errors', value: String(stats.errors), inline: true },
          { name: 'Received', value: String(stats.received), inline: true },
          { name: 'Examples', value: formatRoleSyncDiagnostics(stats.diagnostics) }
        ]);
      }
      res.json({
        ok: true,
        overlay,
        publicPlayers: publicSnapshot.players.length,
        publicPublish: publicSnapshot.publishStats,
        roleSyncOk: !stats.roleSyncError,
        diagnostics: stats.diagnostics ?? [],
        ...stats
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.use('/api', (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = apiErrorStatus(error);
    if (status >= 500) {
      console.error(`API error on ${req.method} ${req.originalUrl}`, error);
    }
    return res.status(status).json({ ok: false, error: apiErrorMessage(error, status) });
  });

  return app.listen(config.port, () => {
    console.log(`Verification/API server listening on http://localhost:${config.port}`);
  });
}
