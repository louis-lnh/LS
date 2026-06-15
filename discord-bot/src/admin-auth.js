import crypto from 'node:crypto';
import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, staffAuditLog } from './logger.js';
import { resolveMinecraftProfile, whitelistAdd, whitelistRemove } from './minecraft.js';

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
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
  return { ...session, role: access.role, workspaces: access.workspaces, permissions: access.permissions };
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
  const permissions = global
    ? [
      'global:audit',
      'integrations:read',
      'staff:read',
      'staff:manage',
      'lifesteal:read',
      'lifesteal:review',
      'lifesteal:ticket',
      'lifesteal:players',
      'lifesteal:events',
      'lifesteal:staff-chat'
    ]
    : [
      'lifesteal:read',
      'lifesteal:review',
      'lifesteal:ticket',
      'lifesteal:events',
      'lifesteal:staff-chat'
    ];
  return {
    role: owner ? 'Owner' : administrator ? 'Administrator' : moderator ? 'Moderator' : 'Staff',
    workspaces: global ? ['global', 'lifesteal', 'general', 'valorant'] : ['lifesteal'],
    permissions
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

function hasPermission(session, permission) {
  return session?.permissions?.includes(permission);
}

function requirePermission(req, res, permission, message = 'You do not have permission to perform this action.') {
  if (hasPermission(req.adminSession, permission)) return false;
  res.status(403).json({ ok: false, code: 'ADMIN_PERMISSION_DENIED', error: message, permission });
  return true;
}

function parseAuditData(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

function auditActivityLabel(event, data) {
  const labels = {
    'admin.submission_claimed': 'claimed a review',
    'admin.submission_note_added': 'added a staff note',
    'admin.submission_decided': 'decided a support review',
    'admin.ticket_message_sent': 'messaged a Discord ticket',
    'admin.staff_chat_message_sent': 'sent a staff chat message',
    'admin.player_created': 'manually added a player',
    'admin.player_updated': 'updated a player',
    'admin.player_deleted': 'deleted a player',
    'admin.player_application_removed': 'removed an applied player',
    'admin.player_application_status_updated': 'updated an applied player',
    'support.application_approved': 'approved a Lifesteal application',
    'support.application_denied': 'denied a Lifesteal application',
    'support.application_submitted': 'received a Lifesteal application',
    'support.submission_created': 'received a support submission',
    'support.rules_ack_created': 'generated a rules acknowledgement',
    'verification.completed': 'completed account verification',
    'minecraft.linked': 'linked a Minecraft account',
    'gameplay.roles_sync': 'synchronized gameplay roles'
  };
  return {
    action: labels[event.type] || event.type.replaceAll('.', ' '),
    target: data.submissionCode || data.applicationCode || data.minecraftName || data.project || 'SHD platform'
  };
}

function adminAuditType(eventType) {
  if (eventType.startsWith('admin.submission') || eventType.startsWith('support.application_')) return 'Review';
  if (eventType.startsWith('support.')) return 'Submission';
  if (eventType.startsWith('admin.player')) return 'Player';
  if (eventType.startsWith('minecraft.') || eventType.startsWith('gameplay.') || eventType.includes('sync')) return 'Integration';
  if (eventType.includes('security') || eventType.includes('rejected') || eventType.includes('ip_')) return 'Security';
  return 'System';
}

function adminAuditResult(eventType, data) {
  if (data?.error || data?.roleSyncError || String(eventType).includes('rejected') || String(eventType).includes('failed')) return 'Warning';
  if (String(eventType).includes('denied') || String(eventType).includes('deleted') || String(eventType).includes('removed')) return 'Blocked';
  return 'Success';
}

async function buildAdminAuditPayload(client, limit = 100) {
  const events = statements.recentAudit.all(Math.min(200, Math.max(1, Number(limit) || 100)));
  const actorNames = await resolveStaffNames(client, events.map((event) => event.discord_id));
  const rows = events.map((event) => {
    const data = parseAuditData(event.data_json);
    const label = auditActivityLabel(event, data);
    return {
      id: event.id,
      actor: event.discord_id ? actorNames.get(event.discord_id) : 'System',
      actorId: event.discord_id ?? null,
      type: adminAuditType(event.type),
      eventType: event.type,
      action: label.action,
      target: label.target,
      result: adminAuditResult(event.type, data),
      createdAt: event.created_at,
      data
    };
  });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return {
    ok: true,
    events: rows,
    summary: {
      eventsToday: rows.filter((event) => event.createdAt >= todayStart.getTime()).length,
      staffActions: rows.filter((event) => event.actorId).length,
      integrationEvents: rows.filter((event) => event.type === 'Integration').length,
      warnings: rows.filter((event) => event.result !== 'Success').length
    },
    updatedAt: Date.now()
  };
}

export async function buildBootstrapPayload(client, session) {
  const snapshot = statements.snapshot.get();
  const ticketsByThread = new Map(snapshot.ticket_threads.map((ticket) => [ticket.thread_id, ticket]));
  const openApplicationStatuses = new Set(['submitted', 'ticket_verified', 'in_review', 'approved_whitelist_pending']);
  const openSupportStatuses = new Set(['submitted', 'ticket_verified', 'in_review', 'waiting_on_player']);
  const openApplications = snapshot.support_applications.filter((item) =>
    openApplicationStatuses.has(item.status)
  ).length;
  const openSupport = snapshot.support_submissions.filter((item) =>
    openSupportStatuses.has(item.status)
  ).length;
  const unclaimedApplications = snapshot.support_applications.filter((item) =>
    openApplicationStatuses.has(item.status) && !ticketsByThread.get(item.ticket_thread_id)?.claimed_by && !item.reviewed_by
  ).length;
  const unclaimedSupport = snapshot.support_submissions.filter((item) =>
    openSupportStatuses.has(item.status) && !item.claimed_by && !item.reviewed_by
  ).length;
  const highPriority = snapshot.support_submissions.filter((item) =>
    item.form_type === 'player_report' && openSupportStatuses.has(item.status)
  ).length;
  const linkedPlayers = snapshot.linked_accounts.filter((item) => item.status === 'active').length;
  const publicSnapshot = snapshot.public_lifesteal_snapshot;

  const guild = await client.guilds.fetch(config.guildId);
  const members = guild.members.cache.size > 0
    ? guild.members.cache
    : await guild.members.fetch().catch(() => guild.members.cache);
  const authorizedStaff = members.filter((member) => Boolean(workspaceAccess(member, guild))).size;

  const auditWindow = statements.recentAudit.all(50);
  const meaningfulAudit = auditWindow.filter((event) => event.type !== 'gameplay.roles_sync');
  const recentAudit = (meaningfulAudit.length > 0 ? meaningfulAudit : auditWindow.slice(0, 1)).slice(0, 6);
  const actorNames = await resolveStaffNames(client, recentAudit.map((event) => event.discord_id));
  const recentActivity = recentAudit.map((event) => {
    const data = parseAuditData(event.data_json);
    const label = auditActivityLabel(event, data);
    return {
      id: event.id,
      actor: event.discord_id ? actorNames.get(event.discord_id) : 'System',
      action: label.action,
      target: label.target,
      type: event.type,
      createdAt: event.created_at
    };
  });

  return {
    ok: true,
    user: publicSession(session),
    metrics: {
      openWork: openApplications + openSupport,
      openApplications,
      openSupport,
      unclaimed: unclaimedApplications + unclaimedSupport,
      highPriority,
      linkedPlayers,
      activeWorkspaces: 1,
      totalWorkspaces: 3,
      botConnections: 1,
      totalBotConnections: 2,
      authorizedStaff
    },
    projects: [
      {
        id: 'lifesteal',
        status: 'operational',
        openWork: openApplications + openSupport,
        detail: `${linkedPlayers} active linked players`
      },
      { id: 'general', status: 'frontend_ready', openWork: 0, detail: 'Backend intake pending' },
      { id: 'valorant', status: 'staged', openWork: 0, detail: 'Workflows not active' }
    ],
    services: {
      adminApi: { status: 'online', detail: 'Protected routes responding' },
      lifestealBot: { status: 'online', detail: `Connected as ${client.user?.tag || 'Discord bot'}` },
      supportPortal: { status: 'online', detail: `${openApplications + openSupport} open intake records` },
      minecraftBridge: {
        status: publicSnapshot.updated_at ? 'online' : 'waiting',
        detail: publicSnapshot.updated_at ? `Last gameplay sync ${publicSnapshot.updated_at}` : 'No gameplay snapshot received'
      },
      shdBot: { status: 'pending', detail: 'General Support and Valorant bot not connected' }
    },
    recentActivity,
    generatedAt: Date.now()
  };
}

function adminSubmissionStatus(status, claimedBy) {
  if (['approved', 'completed', 'resolved'].includes(status)) return 'Approved';
  if (['denied', 'rejected', 'closed'].includes(status)) return 'Denied';
  if (status === 'approved_whitelist_pending' || status === 'waiting_on_player') return 'Waiting on player';
  if (status === 'in_review' || claimedBy) return 'In review';
  return 'New';
}

const adminPlayerStatusMap = new Map([
  ['whitelisted', { label: 'Whitelisted', status: 'active', publicStatsOptIn: true, suspicious: 0 }],
  ['registered', { label: 'Registered', status: 'active', publicStatsOptIn: false, suspicious: 0 }],
  ['review', { label: 'Review', status: 'review', publicStatsOptIn: false, suspicious: 1 }],
  ['banned', { label: 'Banned', status: 'banned', publicStatsOptIn: false, suspicious: 1 }],
  ['denied', { label: 'Denied', status: 'denied', publicStatsOptIn: false, suspicious: 0 }]
]);

const adminPlayerBadgeMap = new Map([
  ['owner', 'Owner'],
  ['admin', 'Admin'],
  ['mod', 'Mod'],
  ['shd-team', 'SHD Team'],
  ['player', 'Player']
]);

function normalizePlayerStatus(value) {
  return adminPlayerStatusMap.get(String(value ?? '').trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')) ?? null;
}

function normalizePlayerBadge(value) {
  const badge = String(value ?? '').trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
  return adminPlayerBadgeMap.has(badge) ? badge : null;
}

function normalizeDiscordId(value) {
  const id = String(value ?? '').trim();
  return /^\d{10,30}$/.test(id) ? id : null;
}

function normalizeMinecraftName(value) {
  const name = String(value ?? '').trim();
  return /^[A-Za-z0-9_]{2,16}$/.test(name) ? name : null;
}

function normalizeManualMinecraftUuid(value, minecraftName) {
  const uuid = String(value ?? '').trim().toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) return uuid;
  if (/^[0-9a-f]{32}$/.test(uuid)) return uuid;
  return `manual:${minecraftName.toLowerCase()}`;
}

function playerStatusLabel(linked) {
  const status = String(linked.status ?? '').toLowerCase();
  if (status === 'banned') return 'Banned';
  if (status === 'denied') return 'Denied';
  if (status === 'review') return 'Review';
  return linked.public_stats_opt_in ? 'Whitelisted' : 'Registered';
}

function playerBadgeLabel(role) {
  return adminPlayerBadgeMap.get(String(role ?? 'player').trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')) ?? 'Player';
}

function latestApplicationForPlayer(applications, linked) {
  const minecraft = String(linked.minecraft_name ?? '').trim().toLowerCase();
  return applications
    .filter((application) =>
      (linked.discord_id && application.discord_id_verified === linked.discord_id) ||
      (minecraft && String(application.minecraft_name ?? '').trim().toLowerCase() === minecraft)
    )
    .sort((left, right) => (right.created_at ?? 0) - (left.created_at ?? 0))[0] ?? null;
}

function serializePlayerApplication(application) {
  if (!application) return null;
  return {
    code: application.code,
    status: application.status,
    discord: application.discord_username,
    minecraft: application.minecraft_name,
    createdAt: application.created_at,
    verifiedAt: application.verified_at ?? null,
    ticketThreadId: application.ticket_thread_id ?? null,
    summary: application.answers?.motivation || 'Lifesteal application submitted through the support portal.',
    fields: applicationFields(application)
  };
}

function playerSnapshotByLinked(publicSnapshot, linked) {
  const names = new Set([String(linked.minecraft_name ?? '').trim().toLowerCase()].filter(Boolean));
  const uuids = new Set([String(linked.minecraft_uuid ?? '').trim().toLowerCase(), String(linked.minecraft_uuid ?? '').replaceAll('-', '').trim().toLowerCase()].filter(Boolean));
  return (publicSnapshot.players ?? []).find((player) => {
    const playerUuid = String(player.minecraft_uuid ?? '').trim().toLowerCase();
    const playerName = String(player.name ?? '').trim().toLowerCase();
    return names.has(playerName) || uuids.has(playerUuid) || uuids.has(playerUuid.replaceAll('-', ''));
  }) ?? null;
}

function serializeLinkedPlayer(linked, applications, publicSnapshot) {
  const application = latestApplicationForPlayer(applications, linked);
  const gameplay = playerSnapshotByLinked(publicSnapshot, linked);
  return {
    id: `linked:${linked.discord_id}`,
    source: 'linked',
    discordId: linked.discord_id,
    discord: linked.discord_username || linked.discord_id,
    minecraftUuid: linked.minecraft_uuid,
    minecraft: linked.minecraft_name || 'Unknown',
    badge: playerBadgeLabel(linked.role),
    badgeValue: String(linked.role ?? 'player').trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-'),
    status: playerStatusLabel(linked),
    sourceStatus: linked.status,
    hearts: gameplay?.hearts_current ?? gameplay?.hearts ?? null,
    risk: linked.risk_band || (linked.suspicious ? 'high' : 'low'),
    updatedAt: linked.roster_status_updated_at ?? linked.last_seen_at ?? linked.verified_at,
    applicationCode: application?.code ?? null,
    application: serializePlayerApplication(application)
  };
}

function serializeAppliedPlayer(application) {
  return {
    id: `application:${application.code}`,
    source: 'application',
    discordId: application.discord_id_verified ?? application.discord_id_claimed ?? null,
    discord: application.discord_username || 'Unknown',
    minecraftUuid: null,
    minecraft: application.minecraft_name || 'Unknown',
    badge: 'Player',
    badgeValue: 'player',
    status: 'Applied',
    sourceStatus: application.status,
    hearts: null,
    risk: 'low',
    updatedAt: application.verified_at ?? application.created_at,
    applicationCode: application.code,
    application: serializePlayerApplication(application)
  };
}

function buildAdminPlayers() {
  const snapshot = statements.snapshot.get();
  const applications = snapshot.support_applications ?? [];
  const publicSnapshot = snapshot.public_lifesteal_snapshot ?? { players: [] };
  const linked = (snapshot.linked_accounts ?? []).map((account) => serializeLinkedPlayer(account, applications, publicSnapshot));
  const linkedNames = new Set(linked.map((player) => player.minecraft.trim().toLowerCase()));
  const linkedDiscordIds = new Set(linked.map((player) => player.discordId).filter(Boolean));
  const applied = applications
    .filter((application) => ['submitted', 'ticket_verified', 'approved_whitelist_pending'].includes(application.status))
    .filter((application) => !linkedNames.has(String(application.minecraft_name ?? '').trim().toLowerCase()))
    .filter((application) => !application.discord_id_verified || !linkedDiscordIds.has(application.discord_id_verified))
    .map(serializeAppliedPlayer);

  const statusRank = { Whitelisted: 0, Registered: 1, Applied: 2, Review: 3, Banned: 4, Denied: 5 };
  const badgeRank = { Owner: 0, Admin: 1, Mod: 2, 'SHD Team': 3, Player: 4 };
  return [...linked, ...applied].sort((left, right) =>
    (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9) ||
    (badgeRank[left.badge] ?? 9) - (badgeRank[right.badge] ?? 9) ||
    left.minecraft.localeCompare(right.minecraft)
  );
}

function findAdminPlayer(id) {
  return buildAdminPlayers().find((player) => player.id === id) ?? null;
}

const finalSupportSubmissionStatuses = new Set(['approved', 'denied', 'rejected', 'closed', 'resolved', 'completed']);

function normalizeAdminText(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function staffChatContent(value) {
  return String(value ?? '').trim().replace(/\r\n/g, '\n').slice(0, 1500);
}

function serializeStaffChatMessage(message) {
  return {
    id: message.id,
    authorId: message.author?.id ?? null,
    authorName: message.author?.globalName || message.member?.displayName || message.author?.username || 'Unknown staff',
    authorAvatarUrl: message.author?.displayAvatarURL?.({ size: 64 }) ?? null,
    content: message.content || '[Message content unavailable]',
    createdAt: message.createdTimestamp
  };
}

function serializeTicketMessage(message, applicantId) {
  return {
    id: message.id,
    type: message.author?.bot ? 'system' : message.author?.id === applicantId ? 'player' : 'staff',
    authorId: message.author?.id ?? null,
    authorName: message.author?.bot
      ? message.author.username
      : message.author?.globalName || message.member?.displayName || message.author?.username || 'Unknown',
    authorAvatarUrl: message.author?.displayAvatarURL?.({ size: 64 }) ?? null,
    content: message.content || '[Message content unavailable]',
    createdAt: message.createdTimestamp
  };
}

async function lifestealStaffChannel(client) {
  if (!config.admin.lifestealStaffChannelId) return { ok: false, reason: 'not_configured', channel: null };
  const channel = await client.channels.fetch(config.admin.lifestealStaffChannelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) return { ok: false, reason: 'not_found', channel: null };
  return { ok: true, channel };
}

function findTicketContext(code) {
  if (code.startsWith('SHD-APP-')) {
    const application = statements.findSupportApplicationByCode.get(code);
    if (!application) return { ok: false, reason: 'not_found' };
    return {
      ok: true,
      kind: 'application',
      status: application.status,
      ticketThreadId: application.ticket_thread_id,
      applicantId: application.discord_id_verified,
      ownerId: null
    };
  }

  const submission = statements.findSupportSubmissionByCode.get(code);
  if (!submission) return { ok: false, reason: 'not_found' };
  return {
    ok: true,
    kind: 'support',
    status: submission.status,
    ticketThreadId: submission.ticket_thread_id,
    applicantId: null,
    ownerId: submission.claimed_by
  };
}

async function ticketThread(client, threadId) {
  if (!threadId) return { ok: false, reason: 'no_ticket', channel: null };
  const channel = await client.channels.fetch(threadId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) return { ok: false, reason: 'not_found', channel: null };
  return { ok: true, channel };
}

function ticketSendOwnershipError(context, sessionId) {
  if (!context.ok) return context.reason;
  if (finalSupportSubmissionStatuses.has(context.status)) return 'final';
  if (!context.ticketThreadId) return 'no_ticket';

  if (context.kind === 'application') {
    const ticket = statements.findTicketByThread.get(context.ticketThreadId);
    if (!ticket) return 'no_ticket';
    if (!ticket.claimed_by) return 'unclaimed';
    if (ticket.claimed_by !== sessionId) return 'claimed';
    return null;
  }

  if (!context.ownerId) return 'unclaimed';
  if (context.ownerId !== sessionId) return 'claimed';
  return null;
}

function supportDecisionStatus(value) {
  const action = String(value ?? '').trim().toLowerCase();
  if (['waiting_on_player', 'waiting', 'request_info'].includes(action)) return 'waiting_on_player';
  if (['approved', 'approve', 'resolved', 'resolve', 'completed'].includes(action)) return 'resolved';
  if (['denied', 'deny', 'rejected', 'reject', 'closed', 'close'].includes(action)) return 'denied';
  return null;
}

function adminApplicationDecisionStatus(value) {
  const action = String(value ?? '').trim().toLowerCase();
  if (['approved', 'approve', 'resolved', 'resolve', 'completed'].includes(action)) return 'approved';
  if (['denied', 'deny', 'rejected', 'reject', 'closed', 'close'].includes(action)) return 'denied';
  return null;
}

function supportReviewOwnershipError(submission, sessionId) {
  if (!submission) return 'not_found';
  if (finalSupportSubmissionStatuses.has(submission.status)) return 'final';
  if (!submission.claimed_by) return 'unclaimed';
  if (submission.claimed_by !== sessionId) return 'claimed';
  return null;
}

function supportApplicationReviewOwnershipError(application, sessionId) {
  if (!application) return 'not_found';
  if (!application.discord_id_verified || !application.ticket_thread_id) return 'no_ticket';
  if (['approved', 'denied', 'rejected', 'closed'].includes(application.status)) return 'final';
  const ticket = statements.findTicketByThread.get(application.ticket_thread_id);
  if (!ticket) return 'no_ticket';
  if (!ticket.claimed_by) return 'unclaimed';
  if (ticket.claimed_by !== sessionId) return 'claimed';
  return null;
}

async function adminMinecraftSideEffect({ type, action, run }) {
  try {
    const result = await run();
    return { ok: true, result, error: null };
  } catch (error) {
    return { ok: false, result: null, error: error.message || `${action} failed`, type };
  }
}

function normalizeEventText(value, max = 240) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeEventStatus(value) {
  const status = String(value ?? 'scheduled').trim().toLowerCase().replaceAll(' ', '_');
  return ['draft', 'scheduled', 'live', 'completed', 'cancelled'].includes(status) ? status : null;
}

function eventTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function eventPriority(value) {
  const parsed = Number(value ?? 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(99, Math.round(parsed))) : 10;
}

function normalizeLifestealEventPayload(body, existing = null) {
  const title = normalizeEventText(body?.title ?? existing?.title, 80);
  const startsAt = eventTimestamp(body?.startsAt ?? existing?.starts_at);
  const endsAtRaw = body?.endsAt === '' ? null : body?.endsAt ?? existing?.ends_at ?? null;
  const endsAt = endsAtRaw === null ? null : eventTimestamp(endsAtRaw);
  const status = normalizeEventStatus(body?.status ?? existing?.status);
  const type = normalizeEventText(body?.type ?? existing?.type, 48) || 'Event';
  const reward = normalizeEventText(body?.reward ?? existing?.reward, 80);
  const objective = normalizeEventText(body?.objective ?? existing?.objective, 500);
  const summary = normalizeEventText(body?.summary ?? existing?.summary, 500);
  const priority = eventPriority(body?.priority ?? existing?.priority);
  const isPublic = body?.public === undefined ? Boolean(existing?.public ?? true) : Boolean(body.public);
  const announce = body?.announce === undefined ? Boolean(existing?.announce ?? false) : Boolean(body.announce);

  if (title.length < 2) return { ok: false, error: 'Event title must contain at least 2 characters.' };
  if (!startsAt) return { ok: false, error: 'Event start time is invalid.' };
  if (endsAt !== null && (!endsAt || endsAt <= startsAt)) return { ok: false, error: 'Event end time must be after the start time.' };
  if (!status) return { ok: false, error: 'Event status is invalid.' };
  if (objective.length < 5) return { ok: false, error: 'Event objective must contain at least 5 characters.' };
  if (summary.length < 5) return { ok: false, error: 'Event summary must contain at least 5 characters.' };

  return {
    ok: true,
    event: { title, startsAt, endsAt, type, reward, objective, summary, priority, status, public: isPublic, announce }
  };
}

function serializeLifestealEvent(event) {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at ?? null,
    type: event.type,
    reward: event.reward ?? '',
    objective: event.objective,
    summary: event.summary,
    priority: event.priority ?? 10,
    status: event.status ?? 'scheduled',
    public: Boolean(event.public),
    announce: Boolean(event.announce),
    announcementMessageId: event.announcement_message_id ?? null,
    createdBy: event.created_by,
    createdAt: event.created_at,
    updatedBy: event.updated_by,
    updatedAt: event.updated_at
  };
}

function buildAdminLifestealEvents() {
  const snapshot = statements.snapshot.get();
  return (snapshot.lifesteal_events ?? [])
    .map(serializeLifestealEvent)
    .sort((left, right) => left.startsAt - right.startsAt || left.priority - right.priority || left.id - right.id);
}

async function announceLifestealEvent(client, event) {
  if (!config.admin.lifestealEventChannelId || !event.announce) return { ok: false, skipped: true, messageId: null };
  const channel = await client.channels.fetch(config.admin.lifestealEventChannelId).catch(() => null);
  if (!channel?.isTextBased?.()) return { ok: false, skipped: true, messageId: null };
  const unix = Math.floor(event.starts_at / 1000);
  const sent = await channel.send({
    content: [
      `**${event.title}**`,
      event.summary,
      `Starts: <t:${unix}:F> (<t:${unix}:R>)`,
      event.reward ? `Reward: ${event.reward}` : null
    ].filter(Boolean).join('\n'),
    allowedMentions: { parse: [] }
  });
  return { ok: true, skipped: false, messageId: sent.id };
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
    ...snapshot.support_submissions.flatMap((item) => [
      item.claimed_by,
      item.reviewed_by,
      ...(item.notes ?? []).map((note) => note.author_id)
    ])
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
      notes: [],
      activity: [
        { type: 'system', author: 'Support Portal', body: 'Application submitted.', time: application.created_at },
        application.verified_at
          ? { type: 'system', author: 'Discord Bot', body: 'Discord identity and application key verified.', time: application.verified_at }
          : null,
        ticket?.claimed_at && claimedById
          ? { type: 'staff', author: staffNames.get(claimedById), body: 'Review claimed.', time: ticket.claimed_at }
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
      notes: (submission.notes ?? []).map((note) => ({
        author: staffNames.get(note.author_id) || note.author_id,
        body: note.text,
        time: note.created_at
      })),
      activity: [
        { type: 'system', author: 'Support Portal', body: `${meta.type} submitted.`, time: submission.created_at },
        submission.claimed_at && claimedById
          ? { type: 'staff', author: staffNames.get(claimedById), body: 'Review claimed.', time: submission.claimed_at }
          : null,
        submission.reviewed_at && submission.reviewed_by
          ? { type: 'staff', author: staffNames.get(submission.reviewed_by), body: submission.review_reason || `Review marked ${submission.status}.`, time: submission.reviewed_at }
          : null
      ].filter(Boolean)
    };
  });

  return [...applications, ...support].sort((left, right) => right.createdAt - left.createdAt);
}

async function findAdminSubmission(client, code) {
  const submissions = await buildAdminSubmissions(client);
  return submissions.find((item) => item.id === code) ?? null;
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
        permissions: access.permissions,
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

  router.get('/bootstrap', requireAdminSession(client), async (req, res) => {
    try {
      return res.json(await buildBootstrapPayload(client, req.adminSession));
    } catch (error) {
      console.error('Admin bootstrap failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_BOOTSTRAP_FAILED', error: 'Could not load global operations.' });
    }
  });

  router.get('/audit', requireAdminSession(client), async (req, res) => {
    if (requirePermission(req, res, 'global:audit', 'Global audit access required.')) return;
    try {
      return res.json(await buildAdminAuditPayload(client, req.query.limit));
    } catch (error) {
      console.error('Admin audit lookup failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_AUDIT_FAILED', error: 'Could not load audit events.' });
    }
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

  router.get('/players', requireAdminSession(client), (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    try {
      return res.json({ ok: true, players: buildAdminPlayers(), updatedAt: Date.now() });
    } catch (error) {
      console.error('Admin player lookup failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_PLAYERS_FAILED', error: 'Could not load players.' });
    }
  });

  router.post('/players', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:players', 'Player management permission required.')) return;

    const discordId = normalizeDiscordId(req.body?.discordId);
    const minecraftName = normalizeMinecraftName(req.body?.minecraftName);
    const discordUsername = normalizeAdminText(req.body?.discordUsername, 80) || discordId;
    const nextStatus = normalizePlayerStatus(req.body?.status ?? 'Registered');
    const nextBadge = normalizePlayerBadge(req.body?.badge ?? 'player');
    if (!discordId) return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_DISCORD_INVALID', error: 'Discord ID must be a numeric Discord user ID.' });
    if (!minecraftName) return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_MINECRAFT_INVALID', error: 'Minecraft name must be 2-16 letters, numbers, or underscores.' });
    if (!nextStatus || nextStatus.label === 'Applied') return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_STATUS_INVALID', error: 'Manual player status is invalid.' });
    if (!nextBadge) return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_BADGE_INVALID', error: 'Manual player badge is invalid.' });

    const now = Date.now();
    const minecraftUuid = normalizeManualMinecraftUuid(req.body?.minecraftUuid, minecraftName);
    try {
      statements.upsertLinked.run({
        discordId,
        minecraftUuid,
        minecraftName,
        discordUsername,
        ipHash: null,
        ipPrefixHash: null,
        verifiedAt: now,
        lastSeenAt: now,
        status: nextStatus.status,
        suspicious: nextStatus.suspicious,
        suspiciousReason: 'Manually added from the admin player manager.',
        riskScore: nextStatus.suspicious ? 60 : 0,
        riskBand: nextStatus.suspicious ? 'high' : 'low',
        riskReasons: nextStatus.suspicious ? ['Manual admin status'] : [],
        role: nextBadge,
        roleManagedAt: now,
        publicStatsOptIn: nextStatus.publicStatsOptIn,
        rosterStatusUpdatedAt: now
      });
    } catch (error) {
      return res.status(409).json({ ok: false, code: 'ADMIN_PLAYER_LINK_CONFLICT', error: error.message || 'Could not create manual player link.' });
    }

    audit('admin.player_created', {
      discordId: req.adminSession.id,
      minecraftUuid,
      data: { targetDiscordId: discordId, minecraftName, status: nextStatus.label, badge: nextBadge, manual: true }
    });
    await staffAuditLog(client, 'Admin Player Manually Added', [
      { name: 'Player', value: minecraftName, inline: true },
      { name: 'Discord ID', value: discordId, inline: true },
      { name: 'Status', value: nextStatus.label, inline: true },
      { name: 'Badge', value: playerBadgeLabel(nextBadge), inline: true },
      { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
    ]);
    return res.status(201).json({ ok: true, players: buildAdminPlayers(), player: findAdminPlayer(`linked:${discordId}`), updatedAt: Date.now() });
  });

  router.patch('/players/:playerId', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:players', 'Player management permission required.')) return;

    const playerId = decodeURIComponent(String(req.params.playerId ?? ''));
    const [source, rawId] = playerId.split(':');
    if (!source || !rawId) {
      return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_ID_INVALID', error: 'Player id is invalid.' });
    }

    const now = Date.now();
    if (source === 'application') {
      const application = statements.findSupportApplicationByCode.get(rawId);
      if (!application) return res.status(404).json({ ok: false, code: 'ADMIN_PLAYER_NOT_FOUND', error: 'Player not found.' });
      const nextStatus = normalizePlayerStatus(req.body?.status);
      if (!nextStatus || !['Denied'].includes(nextStatus.label)) {
        return res.status(400).json({ ok: false, code: 'ADMIN_APPLICATION_PLAYER_STATUS_INVALID', error: 'Applied players can only be removed or denied until they are linked.' });
      }
      statements.updateSupportApplicationStatus.run({
        code: rawId,
        status: 'denied',
        reviewedAt: now,
        reviewedBy: req.adminSession.id,
        reason: 'Marked denied from the admin player manager.'
      });
      audit('admin.player_application_status_updated', {
        discordId: req.adminSession.id,
        data: { playerId, applicationCode: rawId, status: 'denied' }
      });
      await staffAuditLog(client, 'Admin Player Status Updated', [
        { name: 'Player', value: application.minecraft_name || rawId, inline: true },
        { name: 'Status', value: 'Denied', inline: true },
        { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
      ]);
      return res.json({ ok: true, player: findAdminPlayer(playerId), players: buildAdminPlayers() });
    }

    if (source !== 'linked') {
      return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_ID_INVALID', error: 'Player id is invalid.' });
    }

    const linked = statements.findLinkedByDiscord.get(rawId);
    if (!linked) return res.status(404).json({ ok: false, code: 'ADMIN_PLAYER_NOT_FOUND', error: 'Player not found.' });

    const nextStatus = req.body?.status === undefined ? null : normalizePlayerStatus(req.body.status);
    const nextBadge = req.body?.badge === undefined ? null : normalizePlayerBadge(req.body.badge);
    if (req.body?.status !== undefined && !nextStatus) {
      return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_STATUS_INVALID', error: 'Player status is invalid.' });
    }
    if (req.body?.badge !== undefined && !nextBadge) {
      return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_BADGE_INVALID', error: 'Player badge is invalid.' });
    }

    statements.updateLinkedAdminProfile.run({
      discordId: rawId,
      status: nextStatus?.status,
      publicStatsOptIn: nextStatus?.publicStatsOptIn,
      suspicious: nextStatus?.suspicious,
      role: nextBadge ?? undefined,
      reason: 'Updated from the admin player manager.',
      updatedAt: now
    });
    audit('admin.player_updated', {
      discordId: req.adminSession.id,
      minecraftUuid: linked.minecraft_uuid,
      data: { playerId, status: nextStatus?.label ?? null, badge: nextBadge ?? null }
    });
    await staffAuditLog(client, 'Admin Player Updated', [
      { name: 'Player', value: linked.minecraft_name || rawId, inline: true },
      nextStatus ? { name: 'Status', value: nextStatus.label, inline: true } : null,
      nextBadge ? { name: 'Badge', value: playerBadgeLabel(nextBadge), inline: true } : null,
      { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
    ].filter(Boolean));

    return res.json({ ok: true, player: findAdminPlayer(playerId), players: buildAdminPlayers() });
  });

  router.delete('/players/:playerId', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:players', 'Player management permission required.')) return;

    const playerId = decodeURIComponent(String(req.params.playerId ?? ''));
    const [source, rawId] = playerId.split(':');
    const now = Date.now();

    if (source === 'application') {
      const removed = statements.removeSupportApplicationFromRoster.run({
        code: rawId,
        reviewedAt: now,
        reviewedBy: req.adminSession.id,
        reason: 'Removed from the admin player manager roster.'
      });
      if (!removed) return res.status(404).json({ ok: false, code: 'ADMIN_PLAYER_NOT_FOUND', error: 'Player not found.' });
      audit('admin.player_application_removed', {
        discordId: req.adminSession.id,
        data: { playerId, applicationCode: rawId }
      });
      await staffAuditLog(client, 'Admin Player Removed', [
        { name: 'Player', value: removed.minecraft_name || rawId, inline: true },
        { name: 'Source', value: 'Application roster entry', inline: true },
        { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
      ]);
      return res.json({ ok: true, players: buildAdminPlayers() });
    }

    if (source !== 'linked') {
      return res.status(400).json({ ok: false, code: 'ADMIN_PLAYER_ID_INVALID', error: 'Player id is invalid.' });
    }

    const removed = statements.deleteLinkedAccount.run(rawId);
    if (!removed) return res.status(404).json({ ok: false, code: 'ADMIN_PLAYER_NOT_FOUND', error: 'Player not found.' });
    const relatedApplication = latestApplicationForPlayer(statements.snapshot.get().support_applications ?? [], removed);
    if (relatedApplication && ['submitted', 'ticket_verified', 'approved_whitelist_pending'].includes(relatedApplication.status)) {
      statements.removeSupportApplicationFromRoster.run({
        code: relatedApplication.code,
        reviewedAt: now,
        reviewedBy: req.adminSession.id,
        reason: 'Linked player was deleted from the admin player manager.'
      });
    }
    audit('admin.player_deleted', {
      discordId: req.adminSession.id,
      minecraftUuid: removed.minecraft_uuid,
      data: { playerId, targetDiscordId: rawId, minecraftName: removed.minecraft_name }
    });
    await staffAuditLog(client, 'Admin Player Deleted', [
      { name: 'Player', value: removed.minecraft_name || rawId, inline: true },
      { name: 'Discord', value: removed.discord_username || rawId, inline: true },
      { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
    ]);
    return res.json({ ok: true, players: buildAdminPlayers() });
  });

  router.get('/lifesteal/events', requireAdminSession(client), (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    return res.json({ ok: true, events: buildAdminLifestealEvents(), updatedAt: Date.now() });
  });

  router.post('/lifesteal/events', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:events', 'Event management permission required.')) return;

    const payload = normalizeLifestealEventPayload(req.body);
    if (!payload.ok) return res.status(400).json({ ok: false, code: 'ADMIN_EVENT_INVALID', error: payload.error });
    const now = Date.now();
    let event = statements.createLifestealEvent.run({
      ...payload.event,
      createdBy: req.adminSession.id,
      createdAt: now,
      updatedBy: req.adminSession.id,
      updatedAt: now
    });
    let announcement = { ok: false, skipped: true, messageId: null };
    try {
      announcement = await announceLifestealEvent(client, event);
      if (announcement.messageId) {
        event = statements.updateLifestealEvent.run({
          id: event.id,
          announcement_message_id: announcement.messageId,
          updatedBy: req.adminSession.id,
          updatedAt: Date.now()
        });
      }
    } catch (error) {
      announcement = { ok: false, skipped: false, messageId: null, error: error.message };
    }
    audit('admin.lifesteal_event_created', {
      discordId: req.adminSession.id,
      data: { eventId: event.id, title: event.title, startsAt: event.starts_at, announcementOk: announcement.ok }
    });
    await staffAuditLog(client, 'Lifesteal Event Created', [
      { name: 'Event', value: event.title, inline: true },
      { name: 'Start', value: new Date(event.starts_at).toISOString(), inline: true },
      { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true },
      announcement.skipped ? { name: 'Announcement', value: 'Skipped or channel not configured.', inline: true } : { name: 'Announcement', value: announcement.ok ? 'Sent' : 'Failed', inline: true }
    ]);
    return res.status(201).json({ ok: true, event: serializeLifestealEvent(event), events: buildAdminLifestealEvents(), announcement });
  });

  router.patch('/lifesteal/events/:eventId', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:events', 'Event management permission required.')) return;

    const id = Number(req.params.eventId);
    const existing = statements.snapshot.get().lifesteal_events.find((event) => event.id === id);
    if (!existing) return res.status(404).json({ ok: false, code: 'ADMIN_EVENT_NOT_FOUND', error: 'Event not found.' });
    const payload = normalizeLifestealEventPayload(req.body, existing);
    if (!payload.ok) return res.status(400).json({ ok: false, code: 'ADMIN_EVENT_INVALID', error: payload.error });
    const event = statements.updateLifestealEvent.run({
      id,
      title: payload.event.title,
      starts_at: payload.event.startsAt,
      ends_at: payload.event.endsAt,
      type: payload.event.type,
      reward: payload.event.reward,
      objective: payload.event.objective,
      summary: payload.event.summary,
      priority: payload.event.priority,
      status: payload.event.status,
      public: payload.event.public,
      announce: payload.event.announce,
      updatedBy: req.adminSession.id,
      updatedAt: Date.now()
    });
    audit('admin.lifesteal_event_updated', {
      discordId: req.adminSession.id,
      data: { eventId: event.id, title: event.title, startsAt: event.starts_at }
    });
    return res.json({ ok: true, event: serializeLifestealEvent(event), events: buildAdminLifestealEvents() });
  });

  router.delete('/lifesteal/events/:eventId', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:events', 'Event management permission required.')) return;

    const id = Number(req.params.eventId);
    const event = statements.deleteLifestealEvent.run(id);
    if (!event) return res.status(404).json({ ok: false, code: 'ADMIN_EVENT_NOT_FOUND', error: 'Event not found.' });
    audit('admin.lifesteal_event_deleted', {
      discordId: req.adminSession.id,
      data: { eventId: event.id, title: event.title }
    });
    return res.json({ ok: true, events: buildAdminLifestealEvents() });
  });

  router.get('/staff-chat/lifesteal', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }

    const lookup = await lifestealStaffChannel(client);
    if (!lookup.ok) {
      return res.status(503).json({ ok: false, code: 'ADMIN_STAFF_CHAT_UNAVAILABLE', error: 'Lifesteal staff chat channel is not configured or not reachable.' });
    }

    try {
      const fetched = await lookup.channel.messages.fetch({ limit: 50 });
      const messages = [...fetched.values()]
        .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
        .map(serializeStaffChatMessage);
      return res.json({
        ok: true,
        scope: 'lifesteal',
        channelId: lookup.channel.id,
        channelName: lookup.channel.name ?? 'staff-chat',
        messages,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Admin staff chat fetch failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_STAFF_CHAT_FETCH_FAILED', error: 'Could not load staff chat messages.' });
    }
  });

  router.post('/staff-chat/lifesteal', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:staff-chat', 'Staff chat permission required.')) return;

    const content = staffChatContent(req.body?.content);
    if (content.length < 1) {
      return res.status(400).json({ ok: false, code: 'ADMIN_STAFF_CHAT_EMPTY', error: 'Message cannot be empty.' });
    }

    const lookup = await lifestealStaffChannel(client);
    if (!lookup.ok) {
      return res.status(503).json({ ok: false, code: 'ADMIN_STAFF_CHAT_UNAVAILABLE', error: 'Lifesteal staff chat channel is not configured or not reachable.' });
    }

    try {
      const sent = await lookup.channel.send({
        content: `**${req.adminSession.displayName} via Admin Portal**\n${content}`,
        allowedMentions: { parse: [] }
      });
      audit('admin.staff_chat_message_sent', {
        discordId: req.adminSession.id,
        data: {
          scope: 'lifesteal',
          channelId: lookup.channel.id,
          messageId: sent.id
        }
      });
      return res.status(201).json({
        ok: true,
        message: serializeStaffChatMessage(sent)
      });
    } catch (error) {
      console.error('Admin staff chat send failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_STAFF_CHAT_SEND_FAILED', error: 'Could not send staff chat message.' });
    }
  });

  router.get('/submissions/:code/ticket-activity', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }

    const code = String(req.params.code ?? '').trim().toUpperCase();
    const context = findTicketContext(code);
    if (!context.ok) return res.status(404).json({ ok: false, code: 'ADMIN_SUBMISSION_NOT_FOUND', error: 'Submission not found.' });
    const lookup = await ticketThread(client, context.ticketThreadId);
    if (!lookup.ok) {
      return res.status(404).json({ ok: false, code: 'ADMIN_TICKET_NOT_FOUND', error: 'No linked Discord ticket thread is available for this submission.' });
    }

    try {
      const fetched = await lookup.channel.messages.fetch({ limit: 50 });
      const messages = [...fetched.values()]
        .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
        .map((message) => serializeTicketMessage(message, context.applicantId));
      return res.json({
        ok: true,
        submissionCode: code,
        threadId: lookup.channel.id,
        threadName: lookup.channel.name ?? 'ticket',
        messages,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Admin ticket activity fetch failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_TICKET_ACTIVITY_FAILED', error: 'Could not load Discord ticket activity.' });
    }
  });

  router.post('/submissions/:code/ticket-activity', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:ticket', 'Ticket messaging permission required.')) return;

    const code = String(req.params.code ?? '').trim().toUpperCase();
    const content = staffChatContent(req.body?.content);
    if (content.length < 1) {
      return res.status(400).json({ ok: false, code: 'ADMIN_TICKET_MESSAGE_EMPTY', error: 'Message cannot be empty.' });
    }

    const context = findTicketContext(code);
    const ownershipError = ticketSendOwnershipError(context, req.adminSession.id);
    if (ownershipError === 'not_found') return res.status(404).json({ ok: false, code: 'ADMIN_SUBMISSION_NOT_FOUND', error: 'Submission not found.' });
    if (ownershipError === 'no_ticket') return res.status(404).json({ ok: false, code: 'ADMIN_TICKET_NOT_FOUND', error: 'No linked Discord ticket thread is available for this submission.' });
    if (ownershipError === 'final') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_FINAL', error: 'This submission has already been decided.' });
    if (ownershipError === 'unclaimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_UNCLAIMED', error: 'Claim this review before messaging the ticket.' });
    if (ownershipError === 'claimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_ALREADY_CLAIMED', error: 'This review is claimed by another staff member.' });

    const lookup = await ticketThread(client, context.ticketThreadId);
    if (!lookup.ok) return res.status(404).json({ ok: false, code: 'ADMIN_TICKET_NOT_FOUND', error: 'No linked Discord ticket thread is available for this submission.' });

    try {
      const sent = await lookup.channel.send({
        content: `**${req.adminSession.displayName} via Admin Portal**\n${content}`,
        allowedMentions: { parse: [] }
      });
      audit('admin.ticket_message_sent', {
        discordId: req.adminSession.id,
        data: {
          submissionCode: code,
          threadId: lookup.channel.id,
          messageId: sent.id
        }
      });
      await staffAuditLog(client, 'Admin Ticket Message Sent', [
        { name: 'Submission', value: code, inline: true },
        { name: 'Thread', value: `<#${lookup.channel.id}>`, inline: true },
        { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
      ]);
      return res.status(201).json({
        ok: true,
        message: serializeTicketMessage(sent, context.applicantId)
      });
    } catch (error) {
      console.error('Admin ticket message send failed', error);
      return res.status(500).json({ ok: false, code: 'ADMIN_TICKET_MESSAGE_FAILED', error: 'Could not send Discord ticket message.' });
    }
  });

  router.post('/submissions/:code/claim', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:review', 'Review permission required.')) return;

    const code = String(req.params.code ?? '').trim().toUpperCase();
    const now = Date.now();
    let result;

    if (code.startsWith('SHD-APP-')) {
      const application = statements.findSupportApplicationByCode.get(code);
      if (!application) {
        return res.status(404).json({ ok: false, code: 'ADMIN_SUBMISSION_NOT_FOUND', error: 'Submission not found.' });
      }
      if (!application.ticket_thread_id || !application.discord_id_verified) {
        return res.status(409).json({
          ok: false,
          code: 'ADMIN_APPLICATION_NOT_VERIFIED',
          error: 'The applicant must verify their application in Discord before staff can claim it.'
        });
      }
      if (['approved', 'denied', 'rejected', 'closed'].includes(application.status)) {
        return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_FINAL', error: 'This submission has already been decided.' });
      }
      result = statements.claimTicketReview.run({
        threadId: application.ticket_thread_id,
        staffId: req.adminSession.id,
        claimedAt: now
      });
      if (!result.ok && result.reason === 'not_found') {
        return res.status(409).json({ ok: false, code: 'ADMIN_TICKET_NOT_OPEN', error: 'The linked Discord ticket is no longer open.' });
      }
    } else {
      const existing = statements.findSupportSubmissionByCode.get(code);
      if (existing && ['approved', 'denied', 'rejected', 'closed', 'resolved'].includes(existing.status)) {
        return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_FINAL', error: 'This submission has already been decided.' });
      }
      result = statements.claimSupportSubmission.run({
        code,
        staffId: req.adminSession.id,
        claimedAt: now
      });
      if (!result.ok && result.reason === 'not_found') {
        return res.status(404).json({ ok: false, code: 'ADMIN_SUBMISSION_NOT_FOUND', error: 'Submission not found.' });
      }
    }

    if (!result.ok && result.reason === 'claimed') {
      const ownerId = result.ticket?.claimed_by || result.submission?.claimed_by;
      const owner = client.users.cache.get(ownerId) ?? await client.users.fetch(ownerId).catch(() => null);
      const ownerName = owner?.globalName || owner?.username || ownerId;
      return res.status(409).json({
        ok: false,
        code: 'ADMIN_SUBMISSION_ALREADY_CLAIMED',
        error: `This review is already claimed by ${ownerName}.`,
        claimedBy: ownerName,
        claimedById: ownerId
      });
    }

    audit('admin.submission_claimed', {
      discordId: req.adminSession.id,
      data: { submissionCode: code, changed: result.changed }
    });
    if (result.changed) {
      await staffAuditLog(client, 'Admin Review Claimed', [
        { name: 'Submission', value: code, inline: true },
        { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
      ]);
    }

    const submission = await findAdminSubmission(client, code);
    return res.json({ ok: true, changed: result.changed, submission });
  });

  router.post('/submissions/:code/notes', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:review', 'Review permission required.')) return;

    const code = String(req.params.code ?? '').trim().toUpperCase();
    if (code.startsWith('SHD-APP-')) {
      return res.status(409).json({ ok: false, code: 'ADMIN_APPLICATION_COMMAND_ONLY', error: 'Application reviews still use the Discord approval workflow.' });
    }

    const text = normalizeAdminText(req.body?.text);
    if (text.length < 2) {
      return res.status(400).json({ ok: false, code: 'ADMIN_NOTE_TOO_SHORT', error: 'Staff note must contain at least 2 characters.' });
    }

    const current = statements.findSupportSubmissionByCode.get(code);
    const ownershipError = supportReviewOwnershipError(current, req.adminSession.id);
    if (ownershipError === 'not_found') return res.status(404).json({ ok: false, code: 'ADMIN_SUBMISSION_NOT_FOUND', error: 'Submission not found.' });
    if (ownershipError === 'final') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_FINAL', error: 'This submission has already been decided.' });
    if (ownershipError === 'unclaimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_UNCLAIMED', error: 'Claim this review before adding notes.' });
    if (ownershipError === 'claimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_ALREADY_CLAIMED', error: 'This review is claimed by another staff member.' });

    const now = Date.now();
    statements.addSupportSubmissionNote.run({
      code,
      authorId: req.adminSession.id,
      text,
      createdAt: now
    });
    audit('admin.submission_note_added', {
      discordId: req.adminSession.id,
      data: { submissionCode: code }
    });
    await staffAuditLog(client, 'Admin Staff Note Added', [
      { name: 'Submission', value: code, inline: true },
      { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
    ]);

    const submission = await findAdminSubmission(client, code);
    return res.json({ ok: true, submission });
  });

  router.post('/submissions/:code/decision', requireAdminSession(client), async (req, res) => {
    if (!req.adminSession.workspaces.includes('lifesteal')) {
      return res.status(403).json({ ok: false, code: 'ADMIN_WORKSPACE_DENIED', error: 'Lifesteal access required.' });
    }
    if (requirePermission(req, res, 'lifesteal:review', 'Review permission required.')) return;

    const code = String(req.params.code ?? '').trim().toUpperCase();
    if (code.startsWith('SHD-APP-')) {
      const application = statements.findSupportApplicationByCode.get(code);
      const status = adminApplicationDecisionStatus(req.body?.status);
      const reason = normalizeAdminText(req.body?.reason, 3000) || 'Reviewed from the admin portal.';
      if (!status) {
        return res.status(400).json({ ok: false, code: 'ADMIN_APPLICATION_DECISION_INVALID', error: 'Application decision must be approved or denied.' });
      }
      const ownershipError = supportApplicationReviewOwnershipError(application, req.adminSession.id);
      if (ownershipError === 'not_found') return res.status(404).json({ ok: false, code: 'ADMIN_SUBMISSION_NOT_FOUND', error: 'Submission not found.' });
      if (ownershipError === 'no_ticket') return res.status(409).json({ ok: false, code: 'ADMIN_APPLICATION_NOT_VERIFIED', error: 'The applicant must verify their application in Discord before staff can decide it.' });
      if (ownershipError === 'final') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_FINAL', error: 'This application has already been decided.' });
      if (ownershipError === 'unclaimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_UNCLAIMED', error: 'Claim this application before deciding it.' });
      if (ownershipError === 'claimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_ALREADY_CLAIMED', error: 'This application is claimed by another staff member.' });

      const now = Date.now();
      let profile = null;
      let linked = statements.findLinkedByDiscord.get(application.discord_id_verified);
      let whitelistResult = { ok: true, error: null };
      let updatedStatus = status;

      if (status === 'approved') {
        try {
          profile = await resolveMinecraftProfile(application.minecraft_name);
        } catch (error) {
          return res.status(409).json({ ok: false, code: 'ADMIN_MINECRAFT_PROFILE_FAILED', error: error.message || 'Could not resolve the Minecraft profile.' });
        }
        const existingRole = linked?.role ?? 'player';
        const existingRoleManagedAt = linked?.role_managed_at ?? null;
        statements.upsertLinked.run({
          discordId: application.discord_id_verified,
          minecraftUuid: profile.uuid,
          minecraftName: profile.name,
          discordUsername: application.discord_username,
          ipHash: linked?.ip_hash ?? null,
          ipPrefixHash: linked?.ip_prefix_hash ?? null,
          verifiedAt: linked?.verified_at ?? now,
          lastSeenAt: now,
          status: 'active',
          suspicious: 0,
          suspiciousReason: reason,
          riskScore: linked?.risk_score ?? 0,
          riskBand: linked?.risk_band ?? 'low',
          riskReasons: linked?.risk_reasons ?? [],
          role: existingRole,
          roleManagedAt: existingRoleManagedAt,
          publicStatsOptIn: true,
          rosterStatusUpdatedAt: now
        });
        linked = statements.findLinkedByDiscord.get(application.discord_id_verified);
        whitelistResult = await adminMinecraftSideEffect({
          type: 'minecraft.whitelist_add',
          action: 'Add approved applicant to Minecraft whitelist',
          run: () => whitelistAdd(profile.name)
        });
        updatedStatus = whitelistResult.ok ? 'approved' : 'approved_whitelist_pending';
      } else {
        const matchingLinked = linked &&
          String(linked.minecraft_name ?? '').trim().toLowerCase() === String(application.minecraft_name).trim().toLowerCase()
          ? linked
          : null;
        if (matchingLinked) {
          statements.setLinkedStatus.run({
            discordId: application.discord_id_verified,
            status: 'denied',
            suspicious: 0,
            reason,
            rosterStatusUpdatedAt: now
          });
          statements.updateProfile.run({
            discordId: application.discord_id_verified,
            publicStatsOptIn: false
          });
          whitelistResult = await adminMinecraftSideEffect({
            type: 'minecraft.whitelist_remove',
            action: 'Remove denied applicant from Minecraft whitelist',
            run: () => whitelistRemove(matchingLinked.minecraft_name)
          });
        }
      }

      const updatedApplication = statements.updateSupportApplicationStatus.run({
        code,
        status: updatedStatus,
        reviewedAt: now,
        reviewedBy: req.adminSession.id,
        reason
      });
      const ticket = await client.channels.fetch(application.ticket_thread_id).catch(() => null);
      if (ticket?.isTextBased?.()) {
        const message = status === 'approved'
          ? whitelistResult.ok
            ? `<@${application.discord_id_verified}> your Lifesteal application was approved. You should be able to join when the server opens.`
            : `<@${application.discord_id_verified}> your Lifesteal application was approved, but Minecraft access could not be finished automatically. Staff will help you here.`
          : `<@${application.discord_id_verified}> your Lifesteal application was not approved.\nReason: ${reason}`;
        await ticket.send(message).catch(() => null);
      }

      const minecraftUuid = profile?.uuid ?? linked?.minecraft_uuid ?? null;
      statements.addCase.run({
        action: status === 'approved' ? 'support_application_approve' : 'support_application_deny',
        targetDiscordId: application.discord_id_verified,
        targetMinecraftUuid: minecraftUuid,
        moderatorId: req.adminSession.id,
        reason,
        createdAt: now
      });
      audit(status === 'approved' ? 'support.application_approved' : 'support.application_denied', {
        discordId: application.discord_id_verified,
        minecraftUuid,
        data: {
          applicationId: updatedApplication.id,
          applicationCode: updatedApplication.code,
          moderatorId: req.adminSession.id,
          whitelistOk: whitelistResult.ok,
          source: 'admin_portal'
        }
      });
      await staffAuditLog(client, status === 'approved' ? 'Admin Application Approved' : 'Admin Application Denied', [
        { name: 'Application', value: `${updatedApplication.id} / ${updatedApplication.code}`, inline: true },
        { name: 'Applicant', value: `<@${application.discord_id_verified}>`, inline: true },
        { name: 'Minecraft', value: profile?.name ?? application.minecraft_name, inline: true },
        { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true },
        whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error },
        { name: 'Reason', value: reason }
      ].filter(Boolean));

      const submission = await findAdminSubmission(client, code);
      return res.json({ ok: true, submission, whitelistOk: whitelistResult.ok });
    }

    const status = supportDecisionStatus(req.body?.status);
    const reason = normalizeAdminText(req.body?.reason, 3000) || 'Reviewed from the admin portal.';
    if (!status) {
      return res.status(400).json({ ok: false, code: 'ADMIN_DECISION_INVALID', error: 'Decision status must be waiting_on_player, resolved, or denied.' });
    }

    const current = statements.findSupportSubmissionByCode.get(code);
    const ownershipError = supportReviewOwnershipError(current, req.adminSession.id);
    if (ownershipError === 'not_found') return res.status(404).json({ ok: false, code: 'ADMIN_SUBMISSION_NOT_FOUND', error: 'Submission not found.' });
    if (ownershipError === 'final') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_FINAL', error: 'This submission has already been decided.' });
    if (ownershipError === 'unclaimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_UNCLAIMED', error: 'Claim this review before deciding it.' });
    if (ownershipError === 'claimed') return res.status(409).json({ ok: false, code: 'ADMIN_SUBMISSION_ALREADY_CLAIMED', error: 'This review is claimed by another staff member.' });

    const now = Date.now();
    statements.updateSupportSubmissionReview.run({
      code,
      status,
      reviewedAt: now,
      reviewedBy: req.adminSession.id,
      reason
    });
    if (current.ticket_thread_id) {
      const lookup = await ticketThread(client, current.ticket_thread_id);
      if (lookup.ok) {
        const message = status === 'waiting_on_player'
          ? `Staff needs more information for ${code}.\n${reason}`
          : status === 'resolved'
            ? `Your ${code} request has been resolved.\n${reason}`
            : `Your ${code} request was denied.\nReason: ${reason}`;
        await lookup.channel.send({
          content: message,
          allowedMentions: { parse: [] }
        }).catch(() => null);
      }
    }
    audit('admin.submission_decided', {
      discordId: req.adminSession.id,
      data: { submissionCode: code, status, ticketThreadId: current.ticket_thread_id ?? null }
    });
    await staffAuditLog(client, 'Admin Review Decision', [
      { name: 'Submission', value: code, inline: true },
      { name: 'Decision', value: status, inline: true },
      { name: 'Staff', value: `${req.adminSession.displayName} (${req.adminSession.id})`, inline: true }
    ]);

    const submission = await findAdminSubmission(client, code);
    return res.json({ ok: true, submission });
  });

  return router;
}
