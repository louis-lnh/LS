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

function list(name) {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function url(name, fallback = '') {
  return (process.env[name] ?? fallback).replace(/\/+$/, '');
}

export const config = {
  discordToken: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.DISCORD_CLIENT_ID ?? '',
  guildId: process.env.DISCORD_GUILD_ID ?? '',
  port: int('PORT', 3010),
  publicBaseUrl: url('PUBLIC_BASE_URL', 'http://localhost:3010'),
  dataFile: process.env.DATA_FILE ?? './data/shd-bot.json',
  apiSharedSecret: process.env.API_SHARED_SECRET ?? '',
  production: bool('NODE_ENV_PRODUCTION', false) || process.env.NODE_ENV === 'production',
  owners: {
    discordIds: list('ADMIN_OWNER_IDS')
  },
  roles: {
    staff: list('STAFF_ROLE_IDS'),
    admins: list('ADMIN_ROLE_IDS'),
    moderators: list('MODERATOR_ROLE_IDS'),
    support: list('SUPPORT_ROLE_IDS'),
    developers: list('DEVELOPER_ROLE_IDS'),
    member: process.env.SHD_MEMBER_ROLE_ID ?? '',
    verified: process.env.SHD_VERIFIED_ROLE_ID ?? '',
    announcements: process.env.SHD_ANNOUNCEMENTS_ROLE_ID ?? '',
    events: process.env.SHD_EVENTS_ROLE_ID ?? '',
    supportPing: process.env.SHD_SUPPORT_PING_ROLE_ID ?? ''
  },
  channels: {
    securityLog: process.env.SECURITY_LOG_CHANNEL_ID ?? '',
    staffAudit: process.env.STAFF_AUDIT_CHANNEL_ID ?? '',
    supportLog: process.env.SUPPORT_LOG_CHANNEL_ID ?? '',
    systemLog: process.env.SYSTEM_LOG_CHANNEL_ID ?? '',
    ticketNotify: process.env.TICKET_NOTIFY_CHANNEL_ID ?? '',
    ticketArchive: process.env.TICKET_ARCHIVE_CHANNEL_ID ?? ''
  },
  websites: {
    publicSite: url('PUBLIC_SITE_URL'),
    supportSite: url('SUPPORT_SITE_URL'),
    adminSite: url('ADMIN_SITE_URL'),
    allowedOrigins: list('ALLOWED_ORIGINS')
  },
  admin: {
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    sessionSecret: process.env.ADMIN_SESSION_SECRET ?? '',
    portalUrl: url('ADMIN_PORTAL_URL', process.env.ADMIN_SITE_URL ?? 'http://localhost:5178'),
    redirectUrl: process.env.ADMIN_OAUTH_REDIRECT_URL ??
      `${url('PUBLIC_BASE_URL', 'http://localhost:3010')}/api/v1/admin/auth/callback`,
    enabled: Boolean(process.env.DISCORD_CLIENT_SECRET && process.env.ADMIN_SESSION_SECRET)
  },
  rateLimits: {
    publicWrite: {
      windowMs: int('PUBLIC_WRITE_RATE_LIMIT_WINDOW_MS', 60_000),
      max: int('PUBLIC_WRITE_RATE_LIMIT_MAX', 12)
    }
  },
  publicStatus: {
    state: process.env.PUBLIC_STATUS_STATE ?? 'setup',
    message: process.env.PUBLIC_STATUS_MESSAGE ?? 'SHD systems are being prepared.'
  }
};

export function assertRuntimeConfig({ requireDiscord = true } = {}) {
  const missing = [];
  if (requireDiscord && !config.discordToken) missing.push('DISCORD_TOKEN');
  if (requireDiscord && !config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (requireDiscord && !config.guildId) missing.push('DISCORD_GUILD_ID');
  if (!config.apiSharedSecret && config.production) missing.push('API_SHARED_SECRET');
  if (config.production && !config.admin.sessionSecret) missing.push('ADMIN_SESSION_SECRET');
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}
