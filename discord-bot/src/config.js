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
  port: int('PORT', 3000),
  ipHashSecret: process.env.IP_HASH_SECRET ?? 'dev-secret-change-me',
  rulesVersion: process.env.RULES_VERSION ?? 'v1',
  requireVerificationConsent: bool('REQUIRE_VERIFICATION_CONSENT', true),
  verifiedRoleId: process.env.VERIFIED_ROLE_ID ?? '',
  suspiciousRoleId: process.env.SUSPICIOUS_ROLE_ID ?? '',
  discordRulesRoleId: process.env.DISCORD_RULES_ROLE_ID ?? '',
  lifestealRulesRoleId: process.env.LIFESTEAL_RULES_ROLE_ID ?? '',
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
  ticketNotifyChannelId: process.env.TICKET_NOTIFY_CHANNEL_ID ?? '',
  ticketArchiveChannelId: process.env.TICKET_ARCHIVE_CHANNEL_ID ?? '',
  rcon: {
    enabled: bool('MINECRAFT_RCON_ENABLED', false),
    host: process.env.MINECRAFT_RCON_HOST ?? '127.0.0.1',
    port: int('MINECRAFT_RCON_PORT', 25575),
    password: process.env.MINECRAFT_RCON_PASSWORD ?? ''
  },
  apiSharedSecret: process.env.API_SHARED_SECRET ?? ''
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
