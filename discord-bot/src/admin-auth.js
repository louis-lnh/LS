import crypto from 'node:crypto';
import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';

const sessionCookieName = 'shd_admin_session';
const oauthStateCookieName = 'shd_admin_oauth_state';
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const oauthStateLifetimeMs = 10 * 60 * 1000;

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
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;

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
  const portal = new URL(config.admin.portalUrl);
  const target = new URL(path, portal);
  if (target.origin !== portal.origin) return portal.toString();
  return target.toString();
}

function safeReturnPath(value) {
  const path = String(value ?? '/');
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

function adminCors(req, res, next) {
  const origin = String(req.headers.origin ?? '');
  if (origin && origin !== config.admin.portalUrl) {
    return res.status(403).json({ ok: false, code: 'ADMIN_ORIGIN_DENIED', error: 'Origin not allowed.' });
  }
  if (origin && origin === config.admin.portalUrl) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

function sessionFromRequest(req) {
  return parseSignedValue(cookies(req)[sessionCookieName]);
}

async function validatedSession(client, req) {
  const session = sessionFromRequest(req);
  if (!session) return null;

  const guild = await client.guilds.fetch(config.guildId);
  const member = guild.members.cache.get(session.id) ?? await guild.members.fetch(session.id).catch(() => null);
  if (!member) return null;
  const access = workspaceAccess(member, guild);
  if (!access) return null;
  return { ...session, role: access.role, workspaces: access.workspaces };
}

function requireAdminSession(client) {
  return async (req, res, next) => {
    try {
      const session = await validatedSession(client, req);
      if (!session) return res.status(401).json({ ok: false, code: 'ADMIN_AUTH_REQUIRED', error: 'Authentication required.' });
      req.adminSession = session;
      return next();
    } catch (error) {
      console.error('Admin session validation failed', error);
      return res.status(503).json({ ok: false, code: 'ADMIN_AUTH_UNAVAILABLE', error: 'Could not validate the staff session.' });
    }
  };
}

function workspaceAccess(member, guild) {
  const owner = guild.ownerId === member.id || config.admin.ownerIds.includes(member.id);
  const administrator = member.permissions.has(PermissionFlagsBits.Administrator);
  const moderator = member.permissions.has(PermissionFlagsBits.ModerateMembers);
  const configuredRole = config.staffRoleIds.some((roleId) => member.roles.cache.has(roleId));
  if (!owner && !administrator && !moderator && !configuredRole) return null;

  const global = owner || administrator;
  return {
    role: owner ? 'Owner' : administrator ? 'Administrator' : moderator ? 'Moderator' : 'Staff',
    workspaces: global ? ['global', 'lifesteal', 'general', 'valorant'] : ['lifesteal']
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
    expiresAt: session.exp
  };
}

function bootstrapPayload(session) {
  const snapshot = statements.snapshot.get();
  const openApplications = snapshot.support_applications.filter((item) =>
    ['submitted', 'ticket_verified', 'in_review'].includes(item.status)
  ).length;
  const openSupport = snapshot.support_submissions.filter((item) =>
    ['submitted', 'ticket_verified', 'in_review'].includes(item.status)
  ).length;

  return {
    ok: true,
    user: publicSession(session),
    metrics: {
      openWork: openApplications + openSupport,
      openApplications,
      openSupport
    },
    services: {
      adminApi: 'online',
      lifestealBot: 'online',
      supportPortal: 'online',
      shdBot: 'pending'
    }
  };
}

function adminSubmissionStatus(status, claimedBy) {
  if (['approved', 'completed', 'resolved'].includes(status)) return 'Approved';
  if (['denied', 'rejected', 'closed'].includes(status)) return 'Denied';
  if (status === 'approved_whitelist_pending' || status === 'waiting_on_player') return 'Waiting on player';
  if (status === 'in_review' || claimedBy) return 'In review';
  return 'New';
}

function compactFields(entries) {
  return entries
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([label, value]) => ({ label, value: String(value) }));
}

function applicationFields(application) {
  return compactFields([
    ['Region', application.answers?.region],
    ['Timezone', application.answers?.timezone],
    ['Age', application.answers?.age],
    ['How they found Lifesteal', application.answers?.foundLifesteal],
    ['Experience', application.answers?.experience],
    ['Motivation', application.answers?.motivation],
    ['Team', application.answers?.team],
    ['Content / extra', application.answers?.content],
    ['Rules version', application.rules_version]
  ]);
}

function supportSubmissionMeta(submission) {
  if (submission.form_type === 'ban_appeal') {
    return {
      type: 'Appeal',
      title: 'Minecraft ban appeal',
      fields: compactFields([
        ['Ban / case ID', submission.answers?.banId || submission.subject_name],
        ['Punishment', submission.category],
        ['Punishment date', submission.answers?.punishmentDate],
        ['Reason shown', submission.answers?.punishmentReason],
        ['What happened', submission.answers?.context],
        ['Why staff should reconsider', submission.answers?.change],
        ['Evidence', submission.answers?.evidence]
      ])
    };
  }
  if (submission.form_type === 'player_report') {
    return {
      type: 'Player Report',
      title: `Player report: ${submission.subject_name || 'Minecraft player'}`,
      fields: compactFields([
        ['Reported player', submission.subject_name],
        ['Category', submission.category],
        ['Incident time', submission.answers?.incidentTime],
        ['Location', submission.answers?.location],
        ['Incident description', submission.answers?.description],
        ['Evidence', submission.answers?.evidence],
        ['Witnesses', submission.answers?.witnesses],
        ['Extra context', submission.answers?.extra]
      ])
    };
  }
  return {
    type: 'Support',
    title: submission.summary || 'Minecraft support request',
    fields: compactFields([
      ['Category', submission.category],
      ['Issue details', submission.answers?.details],
      ['Error message', submission.answers?.error],
      ['Evidence', submission.answers?.evidence]
    ])
  };
}

async function resolveStaffNames(client, ids) {
  const names = new Map();
  await Promise.all([...new Set(ids.filter(Boolean))].map(async (id) => {
    const user = client.users.cache.get(id) ?? await client.users.fetch(id).catch(() => null);
    names.set(id, user?.globalName || user?.username || id);
  }));
  return names;
}

export async function buildAdminSubmissions(client) {
  const snapshot = statements.snapshot.get();
  const ticketsByThread = new Map(snapshot.ticket_threads.map((ticket) => [ticket.thread_id, ticket]));
  const staffIds = [
    ...snapshot.support_applications.map((item) =>
      ticketsByThread.get(item.ticket_thread_id)?.claimed_by || item.reviewed_by
    ),
    ...snapshot.support_submissions.flatMap((item) => [item.claimed_by, item.reviewed_by])
  ];
  const staffNames = await resolveStaffNames(client, staffIds);

  const applications = snapshot.support_applications.map((application) => {
    const ticket = ticketsByThread.get(application.ticket_thread_id);
    const claimedById = ticket?.claimed_by || application.reviewed_by || null;
    return {
      id: application.code,
      workspace: 'lifesteal',
      type: 'Application',
      status: adminSubmissionStatus(application.status, claimedById),
      sourceStatus: application.status,
      title: 'Lifesteal Season 1 application',
      discord: application.discord_username,
      minecraft: application.minecraft_name,
      subject: null,
      createdAt: application.created_at,
      priority: 'Normal',
      claimedBy: claimedById ? staffNames.get(claimedById) : null,
      claimedById,
      summary: application.answers?.motivation || 'Lifesteal application submitted through the support portal.',
      fields: applicationFields(application),
      ticketThreadId: application.ticket_thread_id,
      requiresTicket: true,
      activity: [
        { type: 'system', author: 'Support Portal', body: 'Application submitted.', time: application.created_at },
        application.verified_at
          ? { type: 'system', author: 'Discord Bot', body: 'Discord identity and application key verified.', time: application.verified_at }
          : null
      ].filter(Boolean)
    };
  });

  const support = snapshot.support_submissions.map((submission) => {
    const meta = supportSubmissionMeta(submission);
    const claimedById = submission.claimed_by || submission.reviewed_by || null;
    return {
      id: submission.code,
      workspace: 'lifesteal',
      type: meta.type,
      status: adminSubmissionStatus(submission.status, claimedById),
      sourceStatus: submission.status,
      title: meta.title,
      discord: submission.discord_username,
      minecraft: submission.minecraft_name || submission.subject_name || 'Unknown',
      subject: submission.subject_name,
      createdAt: submission.created_at,
      priority: submission.form_type === 'player_report' ? 'High' : 'Normal',
      claimedBy: claimedById ? staffNames.get(claimedById) : null,
      claimedById,
      summary: submission.summary,
      fields: meta.fields,
      ticketThreadId: submission.ticket_thread_id,
      requiresTicket: submission.requires_ticket,
      activity: [
        { type: 'system', author: 'Support Portal', body: `${meta.type} submitted.`, time: submission.created_at }
      ]
    };
  });

  return [...applications, ...support].sort((left, right) => right.createdAt - left.createdAt);
}

export function createAdminRouter(client) {
  const router = express.Router();
  router.use(adminCors);

  router.get('/auth/login', (req, res) => {
    if (!config.admin.enabled) return res.redirect(safePortalUrl('/?auth=unavailable'));
    const state = {
      nonce: crypto.randomBytes(24).toString('base64url'),
      returnTo: safeReturnPath(req.query.returnTo),
      exp: Date.now() + oauthStateLifetimeMs
    };
    setCookie(res, oauthStateCookieName, signedValue(state), oauthStateLifetimeMs / 1000);

    const authorize = new URL('https://discord.com/oauth2/authorize');
    authorize.searchParams.set('client_id', config.clientId);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', config.admin.redirectUrl);
    authorize.searchParams.set('scope', 'identify');
    authorize.searchParams.set('state', state.nonce);
    return res.redirect(authorize.toString());
  });

  router.get('/auth/callback', async (req, res) => {
    const state = parseSignedValue(cookies(req)[oauthStateCookieName]);
    clearCookie(res, oauthStateCookieName);
    if (!state || !req.query.state || state.nonce !== req.query.state) {
      return res.redirect(safePortalUrl('/?auth=invalid_state'));
    }

    try {
      const token = await exchangeCode(String(req.query.code ?? ''));
      const user = await fetchDiscordUser(token.access_token);
      const guild = await client.guilds.fetch(config.guildId);
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return res.redirect(safePortalUrl('/?auth=not_member'));
      const access = workspaceAccess(member, guild);
      if (!access) return res.redirect(safePortalUrl('/?auth=denied'));

      const session = {
        id: user.id,
        username: user.username,
        displayName: user.global_name || member.displayName || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
          : null,
        role: access.role,
        workspaces: access.workspaces,
        iat: Date.now(),
        exp: Date.now() + sessionLifetimeMs
      };
      setCookie(res, sessionCookieName, signedValue(session), sessionLifetimeMs / 1000);
      return res.redirect(safePortalUrl(state.returnTo));
    } catch (error) {
      console.error('Admin OAuth callback failed', error);
      return res.redirect(safePortalUrl('/?auth=error'));
    }
  });

  router.get('/auth/session', async (req, res) => {
    try {
      const session = await validatedSession(client, req);
      if (!session) return res.status(401).json({ ok: false, user: null });
      return res.json({ ok: true, user: publicSession(session) });
    } catch (error) {
      console.error('Admin session lookup failed', error);
      return res.status(503).json({ ok: false, user: null });
    }
  });

  router.post('/auth/logout', (_req, res) => {
    clearCookie(res, sessionCookieName);
    return res.json({ ok: true });
  });

  router.get('/bootstrap', requireAdminSession(client), (req, res) => {
    return res.json(bootstrapPayload(req.adminSession));
  });

  router.get('/submissions', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    try {
      const submissions = await buildAdminSubmissions(client);
      return res.json({ ok: true, submissions, updatedAt: Date.now() });
    } catch (error) {
      console.error('Admin submission lookup failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_SUBMISSIONS_FAILED', error: 'Could not load submissions.' });
    }
  });

  return router;
}
