import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, logToChannel } from './logger.js';

const publicStatusSchema = z.object({
  state: z.string().min(2).max(40),
  message: z.string().min(2).max(500)
});

const supportSubmissionSchema = z.object({
  workspace: z.enum(['general', 'support', 'partnerships', 'appeals', 'reports', 'other']).default('support'),
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

function requireApiAuth(req, res, next) {
  if (!config.apiSharedSecret) {
    res.status(503).json({ ok: false, error: 'admin_api_not_configured' });
    return;
  }

  if (!safeEqual(authToken(req), config.apiSharedSecret)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  next();
}

function applyCors(req, res, next) {
  const origin = req.header('origin');
  if (origin && config.websites.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
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
    ticketThreadId: null,
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
  return req.header('x-shd-staff-id') || 'api';
}

export function startWeb(client) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(applyCors);

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

  app.post('/api/v1/public/support/submissions', async (req, res) => {
    const parsed = supportSubmissionSchema.safeParse(req.body);
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
  });

  app.get('/api/v1/public/support/submissions/:code', (req, res) => {
    const submission = statements.supportSubmissions.get(req.params.code);
    if (!submission) {
      res.status(404).json({ ok: false, error: 'submission_not_found' });
      return;
    }
    res.json({ ok: true, submission: publicSubmission(submission) });
  });

  app.get('/api/v1/admin/bootstrap', requireApiAuth, (_req, res) => {
    res.json(adminOverview());
  });

  app.get('/api/v1/admin/system/bootstrap', requireApiAuth, (_req, res) => {
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

  app.get('/api/v1/admin/audit', requireApiAuth, (req, res) => {
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

  app.get('/api/v1/admin/staff', requireApiAuth, (_req, res) => {
    res.json(staffPayload());
  });

  app.post('/api/v1/admin/status', requireApiAuth, (req, res) => {
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

  app.get('/api/v1/admin/submissions', requireApiAuth, (req, res) => {
    const submissions = statements.supportSubmissions.all({
      status: req.query.status,
      workspace: req.query.workspace,
      formType: req.query.formType,
      limit: req.query.limit
    }).map(adminSubmission);
    res.json({ ok: true, submissions });
  });

  app.get('/api/v1/admin/submissions/:code', requireApiAuth, (req, res) => {
    const submission = statements.supportSubmissions.get(req.params.code);
    if (!submission) {
      res.status(404).json({ ok: false, error: 'submission_not_found' });
      return;
    }
    res.json({ ok: true, submission: adminSubmission(submission) });
  });

  app.post('/api/v1/admin/submissions/:code/claim', requireApiAuth, (req, res) => {
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

  app.post('/api/v1/admin/submissions/:code/notes', requireApiAuth, (req, res) => {
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

  app.post('/api/v1/admin/submissions/:code/decision', requireApiAuth, (req, res) => {
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
