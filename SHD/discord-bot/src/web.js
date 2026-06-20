import crypto from 'node:crypto';
import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { z } from 'zod';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, logToChannel } from './logger.js';

const publicStatusSchema = z.object({
  state: z.string().min(2).max(40),
  message: z.string().min(2).max(500)
});

const supportSubmissionSchema = z.object({
  workspace: z.enum(['general', 'support', 'valorant', 'partnerships', 'appeals', 'reports', 'other']).default('support'),
  formType: z.enum(['contact', 'application', 'appeal', 'report', 'support']).default('support'),
  category: z.string().min(2).max(80).default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  discordUsername: z.string().min(2).max(80).optional().nullable(),
  discordId: z.string().min(5).max(32).optional().nullable(),
  email: z.string().email().max(120).optional().nullable(),
  subject: z.string().min(4).max(160),
  message: z.string().min(10).max(5000),
  metadata: z.record(z.unknown()).optional()
});

const claimSchema = z.object({
  staffId: z.string().min(1).max(80)
});

const noteSchema = z.object({
  staffId: z.string().min(1).max(80),
  text: z.string().min(2).max(2000)
});

const decisionSchema = z.object({
  staffId: z.string().min(1).max(80),
  status: z.enum(['resolved', 'approved', 'denied', 'closed', 'needs_info', 'waiting_on_player']),
  reason: z.string().max(2000).optional().nullable()
});

const publicCodePrefix = {
  contact: 'CON',
  application: 'APP',
  appeal: 'APL',
  report: 'RPT',
  support: 'SUP'
};
const sessionCookieName = 'shd_admin_session';
const oauthStateCookieName = 'shd_admin_oauth_state';
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const oauthStateLifetimeMs = 10 * 60 * 1000;
const rateLimitBuckets = new Map();

function safeEqual(a, b) {
  const left = Buffer.from(a ?? '');
  const right = Buffer.from(b ?? '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authToken(req) {
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? '';
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', config.admin.sessionSecret).update(value).digest('base64url');
}

function signedValue(payload) {
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded)}`;
}

function parseSignedValue(value) {
  if (!config.admin.sessionSecret || !value) return null;
  const [encoded, signature] = String(value).split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.exp || Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf('=');
      if (separator === -1) return [entry, ''];
      return [entry.slice(0, separator), decodeURIComponent(entry.slice(separator + 1))];
    }));
}

function cookieOptions(maxAgeSeconds) {
  const secure = config.publicBaseUrl.startsWith('https://');
  return [
    'Path=/api/v1/admin',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${maxAgeSeconds}`
  ].filter(Boolean).join('; ');
}

function setCookie(res, name, value, maxAgeSeconds) {
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; ${cookieOptions(maxAgeSeconds)}`);
}

function clearCookie(res, name) {
  setCookie(res, name, '', 0);
}

function safePortalUrl(path = '/') {
  const portal = new URL(config.admin.portalUrl || 'http://localhost:5178');
  const target = new URL(path, portal);
  if (target.origin !== portal.origin) return portal.toString();
  return target.toString();
}

function safeReturnPath(value) {
  const path = String(value ?? '/');
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

function sessionCookie(req) {
  return parseSignedValue(cookies(req)[sessionCookieName]);
}

async function validatedSession(client, req) {
  const cookie = sessionCookie(req);
  if (!cookie?.sid) return null;

  const stored = statements.adminSessions.get(cookie.sid);
  if (!stored) return null;
  const guild = await client.guilds.fetch(config.guildId);
  const member = await guild.members.fetch(stored.discord_id).catch(() => null);
  if (!member) return null;
  const access = workspaceAccess(member, guild);
  if (!access) return null;

  return {
    id: stored.discord_id,
    username: stored.username,
    displayName: stored.display_name,
    avatarUrl: stored.avatar_url,
    role: access.role,
    workspaces: access.workspaces,
    permissions: access.permissions,
    exp: stored.expires_at,
    sid: stored.id
  };
}

function bearerAuthorized(req) {
  return Boolean(config.apiSharedSecret) && safeEqual(authToken(req), config.apiSharedSecret);
}

function requireAdminAccess(client) {
  return async (req, res, next) => {
    if (bearerAuthorized(req)) {
      req.adminSession = {
        id: req.header('x-shd-staff-id') || 'api',
        displayName: req.header('x-shd-staff-id') || 'API',
        role: 'Service',
        workspaces: ['global', 'general', 'valorant'],
        permissions: ['global:audit', 'staff:read', 'support:review', 'support:write']
      };
      return next();
    }

    try {
      const session = await validatedSession(client, req);
      if (!session) {
        res.status(401).json({ ok: false, code: 'ADMIN_AUTH_REQUIRED', error: 'Authentication required.' });
        return;
      }
      req.adminSession = session;
      return next();
    } catch (error) {
      console.error('Admin session validation failed', error);
      res.status(503).json({ ok: false, code: 'ADMIN_AUTH_UNAVAILABLE', error: 'Could not validate admin session.' });
    }
  };
}

function workspaceAccess(member, guild) {
  const owner = guild.ownerId === member.id || config.owners.discordIds.includes(member.id);
  const administrator = member.permissions.has(PermissionFlagsBits.Administrator);
  const manager = member.permissions.has(PermissionFlagsBits.ManageGuild);
  const staff = [
    ...config.roles.staff,
    ...config.roles.admins,
    ...config.roles.moderators,
    ...config.roles.support,
    ...config.roles.developers
  ].some((roleId) => member.roles.cache.has(roleId));
  if (!owner && !administrator && !manager && !staff) return null;

  const global = owner || administrator || manager || config.roles.admins.some((roleId) => member.roles.cache.has(roleId));
  return {
    role: owner ? 'Owner' : administrator || manager ? 'Administrator' : 'SHD Team',
    workspaces: global ? ['global', 'general', 'valorant'] : ['general'],
    permissions: global
      ? ['global:audit', 'integrations:read', 'staff:read', 'staff:manage', 'support:review', 'support:write']
      : ['support:review']
  };
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.admin.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.admin.redirectUrl
  });
  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error(`Discord token exchange failed with HTTP ${response.status}`);
  return response.json();
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Discord user lookup failed with HTTP ${response.status}`);
  return response.json();
}

function publicSession(session) {
  return {
    id: session.id,
    username: session.username,
    displayName: session.displayName,
    avatarUrl: session.avatarUrl,
    role: session.role,
    workspaces: session.workspaces,
    permissions: session.permissions ?? [],
    expiresAt: session.exp
  };
}

function applyCors(req, res, next) {
  const origin = req.header('origin');
  if (origin && config.websites.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SHD-Staff-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

function clientIp(req) {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    if (!windowMs || !max || max < 1) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${keyPrefix}:${clientIp(req)}`;
    const bucket = (rateLimitBuckets.get(key) ?? []).filter((time) => now - time < windowMs);
    if (bucket.length >= max) {
      const retryAfterMs = windowMs - (now - bucket[0]);
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      res.status(429).json({ ok: false, error: 'rate_limited' });
      return;
    }

    bucket.push(now);
    rateLimitBuckets.set(key, bucket);
    next();
  };
}

function publicSubmission(submission) {
  return {
    code: submission.code,
    status: submission.status,
    workspace: submission.workspace,
    formType: submission.form_type,
    category: submission.category,
    priority: submission.priority,
    subject: submission.subject,
    createdAt: submission.created_at,
    updatedAt: submission.updated_at
  };
}

function adminSubmission(submission) {
  const fields = [
    { label: 'Category', value: submission.category },
    { label: 'Workspace', value: submission.workspace },
    { label: 'Priority', value: submission.priority },
    ...(submission.email ? [{ label: 'Email', value: submission.email }] : []),
    ...(submission.discord_id ? [{ label: 'Discord ID', value: submission.discord_id }] : []),
    ...Object.entries(submission.metadata ?? {}).map(([label, value]) => ({
      label,
      value: typeof value === 'string' ? value : JSON.stringify(value)
    }))
  ].filter((field) => field.value != null && field.value !== '');
  const type = adminSubmissionType(submission.form_type);
  const status = adminSubmissionStatus(submission.status);
  const notes = submission.notes.map((note) => ({
    author: note.author_id,
    body: note.text,
    time: note.created_at
  }));
  const activity = [
    {
      type: 'system',
      author: 'SHD Support',
      body: `${type} submitted.`,
      time: submission.created_at
    },
    ...(submission.claimed_by ? [{
      type: 'staff',
      author: submission.claimed_by,
      body: 'Review claimed in the admin backend.',
      time: submission.claimed_at ?? submission.updated_at
    }] : []),
    ...(submission.reviewed_by ? [{
      type: 'staff',
      author: submission.reviewed_by,
      body: submission.decision_reason || `Review marked as ${status}.`,
      time: submission.reviewed_at ?? submission.updated_at
    }] : [])
  ];

  return {
    id: submission.code,
    workspace: adminWorkspace(submission.workspace),
    type,
    status,
    sourceStatus: submission.status,
    title: submission.subject,
    discord: submission.discord_username ?? submission.discord_id ?? 'Unknown',
    minecraft: '',
    subject: submission.subject,
    createdAt: submission.created_at,
    priority: submission.priority === 'high' || submission.priority === 'urgent' ? 'High' : 'Normal',
    claimedBy: submission.claimed_by,
    claimedById: submission.claimed_by,
    summary: submission.message,
    fields,
    ticketThreadId: submission.ticket_thread_id ?? null,
    requiresTicket: false,
    notes,
    activity
  };
}

function adminSubmissionType(formType) {
  return {
    application: 'Application',
    appeal: 'Appeal',
    report: 'Player Report',
    contact: 'Support',
    support: 'Support'
  }[formType] ?? 'Support';
}

function adminSubmissionStatus(status) {
  return {
    submitted: 'New',
    ticket_verified: 'Ticket verified',
    in_review: 'In review',
    needs_info: 'Waiting on player',
    waiting_on_player: 'Waiting on player',
    approved: 'Approved',
    resolved: 'Approved',
    denied: 'Denied',
    closed: 'Denied'
  }[status] ?? 'New';
}

function adminWorkspace(workspace) {
  if (workspace === 'general' || workspace === 'valorant') return workspace;
  return 'global';
}

function adminAuditEvent(event) {
  const data = event.data ?? {};
  return {
    id: event.id,
    actor: event.actor_id ?? 'System',
    actorId: event.actor_id ?? null,
    type: auditType(event.type),
    eventType: event.type,
    action: auditAction(event.type),
    target: event.target_id ?? data.code ?? data.formType ?? 'SHD',
    result: event.type.includes('blocked') || event.type.includes('denied') ? 'Warning' : 'Success',
    createdAt: event.created_at,
    data
  };
}

function auditType(type) {
  if (type.includes('submission') || type.includes('support')) return 'Submission';
  if (type.includes('admin')) return 'Review';
  if (type.includes('security') || type.includes('auth')) return 'Security';
  if (type.includes('bot') || type.includes('status')) return 'System';
  return 'Integration';
}

function auditAction(type) {
  return type
    .split('.')
    .map((part) => part.replaceAll('_', ' '))
    .join(' / ');
}

function adminOverview() {
  const snapshot = statements.snapshot.get();
  const submissions = snapshot.support_submissions;
  const open = submissions.filter((item) => !['approved', 'resolved', 'denied', 'closed'].includes(item.status));
  const recentAudit = statements.recentAudit.all(10).map(adminAuditEvent);
  return {
    ok: true,
    metrics: {
      openWork: open.length,
      openApplications: open.filter((item) => item.form_type === 'application').length,
      openSupport: open.filter((item) => item.form_type !== 'application').length,
      unclaimed: open.filter((item) => !item.claimed_by).length,
      highPriority: open.filter((item) => ['high', 'urgent'].includes(item.priority)).length,
      linkedPlayers: 0,
      activeWorkspaces: 2,
      totalWorkspaces: 3,
      botConnections: snapshot.service_health.discord_ready_at ? 1 : 0,
      totalBotConnections: 1,
      authorizedStaff: config.owners.discordIds.length + config.roles.staff.length + config.roles.admins.length
    },
    projects: [
      {
        id: 'general',
        status: 'frontend_ready',
        openWork: open.filter((item) => item.workspace !== 'valorant').length,
        detail: 'SHD support backend ready'
      },
      {
        id: 'valorant',
        status: 'staged',
        openWork: open.filter((item) => item.workspace === 'valorant').length,
        detail: 'Valorant workspace staged for future intake'
      }
    ],
    services: {
      shdBot: {
        status: snapshot.service_health.discord_ready_at ? 'online' : 'waiting',
        detail: snapshot.service_health.last_ready_user ?? 'SHD bot backend'
      },
      shdSupportApi: {
        status: snapshot.service_health.api_started_at ? 'online' : 'waiting',
        detail: 'Support and admin API'
      }
    },
    recentActivity: recentAudit.map((event) => ({
      id: event.id,
      actor: event.actor,
      action: event.action,
      target: event.target,
      type: event.type,
      createdAt: event.createdAt
    })),
    generatedAt: Date.now()
  };
}

function staffPayload() {
  const now = Date.now();
  const ownerRows = config.owners.discordIds.map((id, index) => staffRow({
    id,
    index,
    role: 'Owner',
    workspaces: ['global', 'general', 'valorant'],
    permissions: ['global:audit', 'staff:read', 'staff:manage', 'support:review']
  }));
  const staffRows = [...config.roles.staff, ...config.roles.admins, ...config.roles.support]
    .filter((id, index, values) => id && values.indexOf(id) === index && !config.owners.discordIds.includes(id))
    .map((id, index) => staffRow({
      id,
      index: ownerRows.length + index,
      role: config.roles.admins.includes(id) ? 'Administrator' : config.roles.support.includes(id) ? 'Support' : 'SHD Team',
      workspaces: ['general', 'valorant'],
      permissions: ['support:review']
    }));

  return {
    ok: true,
    staff: [...ownerRows, ...staffRows],
    updatedAt: now
  };
}

function staffRow({ id, index, role, workspaces, permissions }) {
  const now = Date.now();
  return {
    id,
    accessRecordId: null,
    name: id,
    discord: id,
    discordId: id,
    avatarUrl: null,
    role,
    workspaces,
    permissions,
    status: 'Active',
    trust: role === 'Owner' || role === 'Administrator' ? 'Full' : 'Scoped',
    source: 'SHD bot env',
    firstSeen: now,
    lastActive: now,
    portalActions: 0,
    notes: 'Loaded from SHD bot role/owner environment configuration.',
    activity: []
  };
}

function issueCode(formType) {
  const prefix = publicCodePrefix[formType] ?? 'SUP';
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `SHD-${prefix}-${random}`;
}

function adminActor(req) {
  return req.header('x-shd-staff-id') || req.adminSession?.id || 'api';
}

async function createSupportSubmission(req, res, client, defaults = {}) {
  const parsed = supportSubmissionSchema.safeParse({ ...defaults, ...req.body });
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_support_submission', issues: parsed.error.issues });
    return;
  }

  const submission = statements.createSupportSubmission.run({
    ...parsed.data,
    code: issueCode(parsed.data.formType),
    createdAt: Date.now()
  });

  audit('support.submission_created', {
    actorId: submission.discord_id ?? 'public',
    targetId: submission.code,
    data: {
      workspace: submission.workspace,
      formType: submission.form_type,
      category: submission.category,
      priority: submission.priority
    }
  });

  await logToChannel(client, config.channels.supportLog, 'New SHD support submission', [
    { name: 'Code', value: submission.code, inline: true },
    { name: 'Type', value: submission.form_type, inline: true },
    { name: 'Priority', value: submission.priority, inline: true },
    { name: 'Subject', value: submission.subject }
  ]);

  res.status(201).json({ ok: true, submission: publicSubmission(submission) });
}

export function startWeb(client) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(applyCors);
  const publicWriteRateLimit = rateLimit({
    windowMs: config.rateLimits.publicWrite.windowMs,
    max: config.rateLimits.publicWrite.max,
    keyPrefix: 'public-write'
  });

  app.get('/api/v1/health', (_req, res) => {
    const snapshot = statements.snapshot.get();
    res.json({
      ok: true,
      service: 'shd-discord-bot',
      uptimeSeconds: Math.round(process.uptime()),
      discordReady: Boolean(client.isReady?.()),
      health: snapshot.service_health
    });
  });

  app.get('/api/v1/public/status', (_req, res) => {
    res.json({
      ok: true,
      status: statements.publicStatus.get(),
      links: {
        publicSite: config.websites.publicSite || null,
        supportSite: config.websites.supportSite || null
      }
    });
  });

  app.post('/api/v1/public/support/submissions', publicWriteRateLimit, async (req, res) => {
    await createSupportSubmission(req, res, client);
  });

  app.post('/api/v1/public/support/contact', publicWriteRateLimit, async (req, res) => {
    await createSupportSubmission(req, res, client, {
      workspace: 'support',
      formType: 'contact',
      category: 'general'
    });
  });

  app.post('/api/v1/public/support/application', publicWriteRateLimit, async (req, res) => {
    await createSupportSubmission(req, res, client, {
      workspace: 'general',
      formType: 'application',
      category: 'application'
    });
  });

  app.post('/api/v1/public/support/appeal', publicWriteRateLimit, async (req, res) => {
    await createSupportSubmission(req, res, client, {
      workspace: 'appeals',
      formType: 'appeal',
      category: 'appeal',
      priority: 'high'
    });
  });

  app.post('/api/v1/public/support/report', publicWriteRateLimit, async (req, res) => {
    await createSupportSubmission(req, res, client, {
      workspace: 'reports',
      formType: 'report',
      category: 'report',
      priority: 'high'
    });
  });

  app.get('/api/v1/public/support/submissions/:code', (req, res) => {
    const submission = statements.supportSubmissions.get(req.params.code);
    if (!submission) {
      res.status(404).json({ ok: false, error: 'submission_not_found' });
      return;
    }
    res.json({ ok: true, submission: publicSubmission(submission) });
  });

  app.get('/api/v1/admin/auth/login', (req, res) => {
    if (!config.admin.enabled) {
      res.status(503).json({ ok: false, code: 'ADMIN_OAUTH_DISABLED', error: 'Admin OAuth is not configured.' });
      return;
    }

    const state = {
      nonce: crypto.randomBytes(18).toString('base64url'),
      returnTo: safeReturnPath(req.query.returnTo)
    };
    setCookie(res, oauthStateCookieName, signedValue({ ...state, exp: Date.now() + oauthStateLifetimeMs }), oauthStateLifetimeMs / 1000);
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.admin.redirectUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state.nonce);
    res.redirect(url.toString());
  });

  app.get('/api/v1/admin/auth/callback', async (req, res) => {
    const state = parseSignedValue(cookies(req)[oauthStateCookieName]);
    clearCookie(res, oauthStateCookieName);
    if (!state?.nonce || state.nonce !== req.query.state || !req.query.code) {
      res.redirect(safePortalUrl('/login?error=oauth_state'));
      return;
    }

    try {
      const token = await exchangeCode(String(req.query.code));
      const user = await fetchDiscordUser(token.access_token);
      const guild = await client.guilds.fetch(config.guildId);
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        res.redirect(safePortalUrl('/login?error=not_in_guild'));
        return;
      }
      const access = workspaceAccess(member, guild);
      if (!access) {
        res.redirect(safePortalUrl('/login?error=no_staff_access'));
        return;
      }

      const sid = crypto.randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + sessionLifetimeMs;
      statements.adminSessions.create({
        id: sid,
        discordId: user.id,
        username: user.username,
        displayName: user.global_name || user.username,
        avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
        expiresAt
      });
      setCookie(res, sessionCookieName, signedValue({ sid, exp: expiresAt }), sessionLifetimeMs / 1000);
      audit('admin.session_started', {
        actorId: user.id,
        data: { role: access.role, workspaces: access.workspaces }
      });
      res.redirect(safePortalUrl(state.returnTo));
    } catch (error) {
      console.error('Admin OAuth callback failed', error);
      res.redirect(safePortalUrl('/login?error=oauth_failed'));
    }
  });

  app.get('/api/v1/admin/auth/session', async (req, res) => {
    if (bearerAuthorized(req)) {
      res.json({
        ok: true,
        user: {
          id: req.header('x-shd-staff-id') || 'api',
          username: 'api',
          displayName: req.header('x-shd-staff-id') || 'API',
          avatarUrl: null,
          role: 'Service',
          workspaces: ['global', 'general', 'valorant'],
          permissions: ['global:audit', 'integrations:read', 'staff:read', 'support:review', 'support:write'],
          expiresAt: Date.now() + sessionLifetimeMs
        }
      });
      return;
    }

    const session = await validatedSession(client, req);
    if (!session) {
      res.status(401).json({ ok: false, user: null });
      return;
    }
    res.json({ ok: true, user: publicSession(session) });
  });

  app.post('/api/v1/admin/auth/logout', async (req, res) => {
    const cookie = sessionCookie(req);
    if (cookie?.sid) statements.adminSessions.delete(cookie.sid);
    clearCookie(res, sessionCookieName);
    res.json({ ok: true });
  });

  const requireAdmin = requireAdminAccess(client);

  app.get('/api/v1/admin/bootstrap', requireAdmin, (_req, res) => {
    res.json(adminOverview());
  });

  app.get('/api/v1/admin/system/bootstrap', requireAdmin, (_req, res) => {
    const snapshot = statements.snapshot.get();
    res.json({
      ok: true,
      guildId: config.guildId,
      rolesConfigured: Object.fromEntries(Object.entries(config.roles).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.length : Boolean(value)
      ])),
      channelsConfigured: Object.fromEntries(Object.entries(config.channels).map(([key, value]) => [key, Boolean(value)])),
      health: snapshot.service_health,
      openSubmissionCount: snapshot.support_submissions.filter((item) => !['approved', 'resolved', 'denied', 'closed'].includes(item.status)).length,
      recentAudit: statements.recentAudit.all(10)
    });
  });

  app.get('/api/v1/admin/audit', requireAdmin, (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const events = statements.recentAudit.all(limit).map(adminAuditEvent);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    res.json({
      ok: true,
      events,
      summary: {
        eventsToday: events.filter((event) => event.createdAt >= todayStart.getTime()).length,
        staffActions: events.filter((event) => event.type === 'Review').length,
        integrationEvents: events.filter((event) => event.type === 'Integration').length,
        warnings: events.filter((event) => event.result === 'Warning').length
      },
      updatedAt: Date.now()
    });
  });

  app.get('/api/v1/admin/staff', requireAdmin, (_req, res) => {
    res.json(staffPayload());
  });

  app.post('/api/v1/admin/status', requireAdmin, (req, res) => {
    const parsed = publicStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_status_payload' });
      return;
    }

    const status = statements.publicStatus.set(parsed.data);
    audit('admin.public_status_updated', {
      actorId: 'api',
      data: status
    });
    res.json({ ok: true, status });
  });

  app.get('/api/v1/admin/submissions', requireAdmin, (req, res) => {
    const submissions = statements.supportSubmissions.all({
      status: req.query.status,
      workspace: req.query.workspace,
      formType: req.query.formType,
      limit: req.query.limit
    }).map(adminSubmission);
    res.json({ ok: true, submissions });
  });

  app.get('/api/v1/admin/submissions/:code', requireAdmin, (req, res) => {
    const submission = statements.supportSubmissions.get(req.params.code);
    if (!submission) {
      res.status(404).json({ ok: false, error: 'submission_not_found' });
      return;
    }
    res.json({ ok: true, submission: adminSubmission(submission) });
  });

  app.post('/api/v1/admin/submissions/:code/claim', requireAdmin, (req, res) => {
    const parsed = claimSchema.safeParse({ staffId: req.body?.staffId ?? adminActor(req) });
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_claim_payload' });
      return;
    }

    const result = statements.supportSubmissions.claim(req.params.code, parsed.data.staffId);
    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : 409;
      res.status(status).json({ ok: false, error: result.reason, submission: result.submission ? adminSubmission(result.submission) : null });
      return;
    }

    audit('admin.submission_claimed', {
      actorId: parsed.data.staffId,
      targetId: req.params.code,
      data: { changed: result.changed }
    });
    res.json({ ok: true, changed: result.changed, submission: adminSubmission(result.submission) });
  });

  app.post('/api/v1/admin/submissions/:code/notes', requireAdmin, (req, res) => {
    const parsed = noteSchema.safeParse({ ...req.body, staffId: req.body?.staffId ?? adminActor(req) });
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_note_payload' });
      return;
    }

    const note = statements.supportSubmissions.addNote(req.params.code, parsed.data.staffId, parsed.data.text);
    if (!note) {
      res.status(404).json({ ok: false, error: 'submission_not_found' });
      return;
    }

    audit('admin.submission_note_added', {
      actorId: parsed.data.staffId,
      targetId: req.params.code
    });
    const submission = statements.supportSubmissions.get(req.params.code);
    res.status(201).json({ ok: true, note, submission: adminSubmission(submission) });
  });

  app.post('/api/v1/admin/submissions/:code/decision', requireAdmin, (req, res) => {
    const parsed = decisionSchema.safeParse({ ...req.body, staffId: req.body?.staffId ?? adminActor(req) });
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid_decision_payload', issues: parsed.error.issues });
      return;
    }

    const submission = statements.supportSubmissions.decide(
      req.params.code,
      parsed.data.staffId,
      parsed.data.status,
      parsed.data.reason
    );
    if (!submission) {
      res.status(404).json({ ok: false, error: 'submission_not_found' });
      return;
    }

    audit('admin.submission_decided', {
      actorId: parsed.data.staffId,
      targetId: req.params.code,
      data: { status: parsed.data.status }
    });
    res.json({ ok: true, submission: adminSubmission(submission) });
  });

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'not_found' });
  });

  const server = app.listen(config.port, () => {
    statements.updateHealth.run({ api_started_at: Date.now() });
    console.log(`SHD bot API listening on ${config.port}`);
  });

  return server;
}
