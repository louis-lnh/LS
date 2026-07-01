import 'dotenv/config';

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

const publicPrestigeBadgeIds = new Set([
  'owner',
  'admin',
  'mod',
  'shd-team',
  'dragon-egg',
  'mace-1',
  'mace-2'
]);

const defaultPublicPrestigeBadges = new Map([
  ['f4ae7f4f-cb60-45ff-bb15-576c89330e78', ['shd-team']],
  ['a5f7ba0b-cee1-4137-9b9b-835285ed606c', ['shd-team']]
]);

function normalizeMinecraftUuid(value) {
  return String(value ?? '').trim().toLowerCase();
}

function publicPrestigeBadges() {
  const raw = process.env.PUBLIC_PRESTIGE_BADGES ?? '';
  const badgesByUuid = new Map();

  for (const [uuidValue, badges] of defaultPublicPrestigeBadges) {
    const uuid = normalizeMinecraftUuid(uuidValue);
    badgesByUuid.set(uuid, badges);
    badgesByUuid.set(uuid.replaceAll('-', ''), badges);
  }

  for (const entry of raw.split(';')) {
    const [uuidValue, badgesValue] = entry.split(':');
    const uuid = normalizeMinecraftUuid(uuidValue);
    if (!uuid || !badgesValue) continue;

    const badges = badgesValue
      .split(',')
      .map((value) => value.trim().toLowerCase().replaceAll('_', '-'))
      .filter((value) => publicPrestigeBadgeIds.has(value));

    if (badges.length === 0) continue;
    badgesByUuid.set(uuid, [...new Set(badges)]);
    badgesByUuid.set(uuid.replaceAll('-', ''), [...new Set(badges)]);
  }

  return badgesByUuid;
}

const heartRoleEnvNames = [
  '',
  'ONE_HEARTS_ROLE_ID',
  'TWO_HEARTS_ROLE_ID',
  'THREE_HEARTS_ROLE_ID',
  'FOUR_HEARTS_ROLE_ID',
  'FIVE_HEARTS_ROLE_ID',
  'SIX_HEARTS_ROLE_ID',
  'SEVEN_HEARTS_ROLE_ID',
  'EIGHT_HEARTS_ROLE_ID',
  'NINE_HEARTS_ROLE_ID',
  'TEN_HEARTS_ROLE_ID',
  'ELEVEN_HEARTS_ROLE_ID',
  'TWELVE_HEARTS_ROLE_ID',
  'THIRTEEN_HEARTS_ROLE_ID',
  'FOURTEEN_HEARTS_ROLE_ID',
  'FIFTEEN_HEARTS_ROLE_ID',
  'SIXTEEN_HEARTS_ROLE_ID',
  'SEVENTEEN_HEARTS_ROLE_ID',
  'EIGHTEEN_HEARTS_ROLE_ID',
  'NINETEEN_HEARTS_ROLE_ID',
  'TWENTY_HEARTS_ROLE_ID'
];

function heartRoleIds() {
  return Object.fromEntries(heartRoleEnvNames
    .map((name, hearts) => [hearts, name ? process.env[name] ?? '' : ''])
    .filter(([hearts]) => hearts > 0));
}

export const config = {
  discordToken: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.DISCORD_CLIENT_ID ?? '',
  guildId: process.env.DISCORD_GUILD_ID ?? '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
  supportPortalUrl: process.env.SUPPORT_PORTAL_URL ?? 'https://support.shd-esports.com',
  port: int('PORT', 3000),
  ipHashSecret: process.env.IP_HASH_SECRET ?? 'dev-secret-change-me',
  rulesVersion: process.env.RULES_VERSION ?? 'v1',
  requireVerificationConsent: bool('REQUIRE_VERIFICATION_CONSENT', true),
  verifiedRoleId: process.env.VERIFIED_ROLE_ID ?? '',
  suspiciousRoleId: process.env.SUSPICIOUS_ROLE_ID ?? '',
  discordRulesRoleId: process.env.DISCORD_RULES_ROLE_ID ?? '',
  lifestealRulesRoleId: process.env.LIFESTEAL_RULES_ROLE_ID ?? '',
  announcementRoleId: process.env.LIFESTEAL_ANNOUNCEMENTS_ROLE_ID ?? process.env.ANNOUNCEMENTS_ROLE_ID ?? '',
  notificationRoleIds: {
    announcements: process.env.LIFESTEAL_ANNOUNCEMENTS_ROLE_ID ?? process.env.ANNOUNCEMENTS_ROLE_ID ?? '',
    ingame: process.env.LIFESTEAL_INGAME_NOTIFICATIONS_ROLE_ID ?? process.env.INGAME_NOTIFICATIONS_ROLE_ID ?? '',
    events: process.env.LIFESTEAL_EVENT_NOTIFICATIONS_ROLE_ID ?? process.env.EVENT_NOTIFICATIONS_ROLE_ID ?? ''
  },
  staffRoleIds: (process.env.STAFF_ROLE_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  gameplayRoleIds: {
    mace: process.env.MACE_ROLE_ID ?? '',
    twentyHearts: process.env.TWENTY_HEARTS_ROLE_ID ?? '',
    dragonEgg: process.env.DRAGON_EGG_ROLE_ID ?? '',
    eliminated: process.env.ELIMINATED_ROLE_ID ?? '',
    hearts: heartRoleIds()
  },
  publicPrestigeBadges: publicPrestigeBadges(),
  overlay: {
    lifestealPlayerUuid: (process.env.OVERLAY_LIFESTEAL_PLAYER_UUID ?? '').toLowerCase(),
    publicToken: process.env.OVERLAY_PUBLIC_TOKEN ?? ''
  },
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID ?? '',
  verifyLogChannelId: process.env.VERIFY_LOG_CHANNEL_ID ?? '',
  securityLogChannelId: process.env.SECURITY_LOG_CHANNEL_ID ?? '',
  minecraftLogChannelId: process.env.MINECRAFT_LOG_CHANNEL_ID ?? '',
  appealLogChannelId: process.env.APPEAL_LOG_CHANNEL_ID ?? '',
  staffAuditChannelId: process.env.STAFF_AUDIT_CHANNEL_ID ?? '',
  previewNotifChannelId: process.env.PREVIEW_NOTIF_CHANNEL_ID ?? '',
  ticketNotifyChannelId: process.env.TICKET_NOTIFY_CHANNEL_ID ?? '',
  ticketArchiveChannelId: process.env.TICKET_ARCHIVE_CHANNEL_ID ?? '',
  supportApplicationLogChannelId: process.env.SUPPORT_APPLICATION_LOG_CHANNEL_ID ?? '',
  rcon: {
    enabled: bool('MINECRAFT_RCON_ENABLED', false),
    host: process.env.MINECRAFT_RCON_HOST ?? '127.0.0.1',
    port: int('MINECRAFT_RCON_PORT', 25575),
    password: process.env.MINECRAFT_RCON_PASSWORD ?? ''
  },
  apiSharedSecret: process.env.API_SHARED_SECRET ?? '',
  admin: {
    portalUrl: (process.env.ADMIN_PORTAL_URL ?? 'http://127.0.0.1:4177').replace(/\/+$/, ''),
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    sessionSecret: process.env.ADMIN_SESSION_SECRET ?? '',
    lifestealStaffChannelId: process.env.ADMIN_LIFESTEAL_STAFF_CHANNEL_ID ?? '',
    lifestealEventChannelId: process.env.ADMIN_LIFESTEAL_EVENT_CHANNEL_ID ?? '',
    ownerIds: (process.env.ADMIN_OWNER_IDS ?? '1224803434675572827')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    redirectUrl: process.env.ADMIN_OAUTH_REDIRECT_URL ??
      `${process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/v1/admin/auth/callback`,
    enabled: Boolean(process.env.DISCORD_CLIENT_SECRET && process.env.ADMIN_SESSION_SECRET)
  }
};

export function assertRuntimeConfig() {
  const missing = [];
  if (!config.discordToken) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.guildId) missing.push('DISCORD_GUILD_ID');
  if (config.ipHashSecret === 'dev-secret-change-me') missing.push('IP_HASH_SECRET');
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}
