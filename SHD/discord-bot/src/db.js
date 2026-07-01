import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const dbPath = resolve(process.cwd(), config.dataFile);
mkdirSync(dirname(dbPath), { recursive: true });

const initialState = {
  schema_version: 1,
  created_at: Date.now(),
  updated_at: Date.now(),
  audit_events: [],
  service_health: {
    bot_started_at: null,
    api_started_at: null,
    discord_ready_at: null,
    last_ready_user: null
  },
  public_status: {
    state: config.publicStatus.state,
    message: config.publicStatus.message,
    updated_at: Date.now()
  },
  support_submissions: [],
  admin_sessions: [],
  ticket_threads: [],
  mod_cases: [],
  twitch_live_states: [],
  rules_acceptances: [],
  role_assignments: [],
  role_panel_messages: [],
  notification_previews: [],
  settings: {},
  counters: {
    audit_events: 1,
    support_submissions: 1,
    support_notes: 1,
    ticket_threads: 1,
    mod_cases: 1,
    role_panel_messages: 1,
    rules_acceptances: 1,
    role_assignments: 1,
    notification_previews: 1
  }
};

function clone(value) {
  return structuredClone(value);
}

function load() {
  if (!existsSync(dbPath)) return clone(initialState);
  const loaded = JSON.parse(readFileSync(dbPath, 'utf8'));
  return {
    ...clone(initialState),
    ...loaded,
    service_health: {
      ...clone(initialState.service_health),
      ...(loaded.service_health ?? {})
    },
    public_status: {
      ...clone(initialState.public_status),
      ...(loaded.public_status ?? {})
    },
    counters: {
      ...clone(initialState.counters),
      ...(loaded.counters ?? {})
    }
  };
}

const state = load();
persist();

function persist() {
  state.updated_at = Date.now();
  writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

function auditHash(row) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      id: row.id,
      type: row.type,
      actor_id: row.actor_id,
      data: row.data,
      created_at: row.created_at,
      previous_hash: row.previous_hash
    }))
    .digest('hex');
}

export const statements = {
  addAudit: {
    run(row) {
      const previous = state.audit_events.at(-1);
      const auditRow = {
        id: state.counters.audit_events++,
        type: row.type,
        actor_id: row.actorId ?? null,
        target_id: row.targetId ?? null,
        data: row.data ?? {},
        created_at: row.createdAt ?? Date.now(),
        previous_hash: previous?.event_hash ?? null
      };
      auditRow.event_hash = auditHash(auditRow);
      state.audit_events.push(auditRow);
      persist();
      return clone(auditRow);
    }
  },
  recentAudit: {
    all(limit = 25) {
      return clone([...state.audit_events].sort((a, b) => b.created_at - a.created_at).slice(0, limit));
    }
  },
  updateHealth: {
    run(values) {
      Object.assign(state.service_health, values);
      persist();
      return clone(state.service_health);
    }
  },
  publicStatus: {
    get() {
      return clone(state.public_status);
    },
    set(values) {
      Object.assign(state.public_status, values, { updated_at: Date.now() });
      persist();
      return clone(state.public_status);
    }
  },
  createSupportSubmission: {
    run(row) {
      const id = state.counters.support_submissions++;
      const now = row.createdAt ?? Date.now();
      const submission = {
        id,
        code: row.code,
        workspace: row.workspace,
        form_type: row.formType,
        category: row.category,
        priority: row.priority ?? 'normal',
        discord_username: row.discordUsername ?? null,
        discord_id: row.discordId ?? null,
        email: row.email ?? null,
        subject: row.subject,
        message: row.message,
        metadata: row.metadata ?? {},
        status: 'submitted',
        claimed_by: null,
        claimed_at: null,
        reviewed_by: null,
        reviewed_at: null,
        decision: null,
        decision_reason: null,
        notes: [],
        created_at: now,
        updated_at: now
      };
      state.support_submissions.push(submission);
      persist();
      return clone(submission);
    }
  },
  supportSubmissions: {
    all(filters = {}) {
      const status = filters.status && filters.status !== 'all' ? filters.status : null;
      const workspace = filters.workspace && filters.workspace !== 'all' ? filters.workspace : null;
      const formType = filters.formType && filters.formType !== 'all' ? filters.formType : null;
      const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
      return clone(state.support_submissions
        .filter((row) => !status || row.status === status)
        .filter((row) => !workspace || row.workspace === workspace)
        .filter((row) => !formType || row.form_type === formType)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit));
    },
    get(code) {
      return clone(state.support_submissions.find((row) => row.code === code) ?? null);
    },
    claim(code, staffId) {
      const submission = state.support_submissions.find((row) => row.code === code);
      if (!submission) return { ok: false, reason: 'not_found', submission: null };
      if (submission.claimed_by && submission.claimed_by !== staffId) {
        return { ok: false, reason: 'claimed', submission: clone(submission) };
      }
      if (['resolved', 'denied', 'closed'].includes(submission.status)) {
        return { ok: false, reason: 'final', submission: clone(submission) };
      }
      if (submission.claimed_by === staffId) {
        return { ok: true, changed: false, submission: clone(submission) };
      }

      submission.claimed_by = staffId;
      submission.claimed_at = Date.now();
      submission.updated_at = submission.claimed_at;
      if (submission.status === 'submitted' || submission.status === 'ticket_verified') {
        submission.status = 'in_review';
      }
      persist();
      return { ok: true, changed: true, submission: clone(submission) };
    },
    addNote(code, staffId, text) {
      const submission = state.support_submissions.find((row) => row.code === code);
      if (!submission) return null;
      const now = Date.now();
      const note = {
        id: state.counters.support_notes++,
        author_id: staffId,
        text,
        created_at: now
      };
      submission.notes.push(note);
      submission.updated_at = now;
      persist();
      return clone(note);
    },
    decide(code, staffId, status, reason) {
      const submission = state.support_submissions.find((row) => row.code === code);
      if (!submission) return null;
      const now = Date.now();
      submission.status = status;
      submission.reviewed_by = staffId;
      submission.reviewed_at = now;
      submission.decision = status;
      submission.decision_reason = reason ?? null;
      submission.updated_at = now;
      if (!submission.claimed_by) {
        submission.claimed_by = staffId;
        submission.claimed_at = now;
      }
      persist();
      return clone(submission);
    },
    attachTicket(code, threadId) {
      const submission = state.support_submissions.find((row) => row.code === code);
      if (!submission) return null;
      submission.ticket_thread_id = threadId;
      submission.updated_at = Date.now();
      if (submission.status === 'submitted') {
        submission.status = 'ticket_verified';
      }
      persist();
      return clone(submission);
    }
  },
  ticketThreads: {
    create(row) {
      const now = row.createdAt ?? Date.now();
      const ticket = {
        id: state.counters.ticket_threads++,
        type: row.type,
        thread_id: row.threadId,
        channel_id: row.channelId,
        discord_id: row.discordId,
        submission_code: row.submissionCode ?? null,
        status: 'open',
        claimed_by: null,
        claimed_at: null,
        closed_at: null,
        close_reason: null,
        created_at: now,
        updated_at: now
      };
      state.ticket_threads.push(ticket);
      persist();
      return clone(ticket);
    },
    findOpenByThread(threadId) {
      return clone(state.ticket_threads.find((row) => row.thread_id === threadId && row.status === 'open') ?? null);
    },
    findOpenForUser(discordId, type) {
      return clone(state.ticket_threads.find((row) =>
        row.discord_id === discordId &&
        row.type === type &&
        row.status === 'open'
      ) ?? null);
    },
    attachSubmission(threadId, code) {
      const ticket = state.ticket_threads.find((row) => row.thread_id === threadId && row.status === 'open');
      if (!ticket) return null;
      ticket.submission_code = code;
      ticket.updated_at = Date.now();
      persist();
      return clone(ticket);
    },
    claim(threadId, staffId) {
      const ticket = state.ticket_threads.find((row) => row.thread_id === threadId && row.status === 'open');
      if (!ticket) return { ok: false, reason: 'not_found', ticket: null };
      if (ticket.claimed_by && ticket.claimed_by !== staffId) {
        return { ok: false, reason: 'claimed', ticket: clone(ticket) };
      }
      if (ticket.claimed_by === staffId) {
        return { ok: true, changed: false, ticket: clone(ticket) };
      }
      ticket.claimed_by = staffId;
      ticket.claimed_at = Date.now();
      ticket.updated_at = ticket.claimed_at;
      persist();
      return { ok: true, changed: true, ticket: clone(ticket) };
    },
    close(threadId, reason, closedBy) {
      const ticket = state.ticket_threads.find((row) => row.thread_id === threadId && row.status === 'open');
      if (!ticket) return null;
      ticket.status = 'closed';
      ticket.closed_at = Date.now();
      ticket.close_reason = reason ?? null;
      ticket.closed_by = closedBy ?? null;
      ticket.updated_at = ticket.closed_at;
      persist();
      return clone(ticket);
    }
  },
  modCases: {
    create(row) {
      const now = row.createdAt ?? Date.now();
      const modCase = {
        id: state.counters.mod_cases++,
        type: row.type,
        actor_id: row.actorId,
        target_id: row.targetId ?? null,
        target_tag: row.targetTag ?? null,
        guild_id: row.guildId ?? null,
        channel_id: row.channelId ?? null,
        reason: row.reason ?? 'No reason provided.',
        duration_ms: row.durationMs ?? null,
        message_count: row.messageCount ?? null,
        metadata: row.metadata ?? {},
        active: row.active ?? true,
        created_at: now,
        updated_at: now
      };
      state.mod_cases.push(modCase);
      persist();
      return clone(modCase);
    },
    get(id) {
      return clone(state.mod_cases.find((row) => row.id === Number(id)) ?? null);
    },
    forUser(userId, limit = 10) {
      return clone(state.mod_cases
        .filter((row) => row.target_id === userId)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, Math.min(Math.max(Number(limit) || 10, 1), 25)));
    },
    warningsForUser(userId, limit = 10) {
      return clone(state.mod_cases
        .filter((row) => row.target_id === userId && row.type === 'warn')
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, Math.min(Math.max(Number(limit) || 10, 1), 25)));
    },
    clearWarning(caseId, actorId, reason) {
      const modCase = state.mod_cases.find((row) => row.id === Number(caseId) && row.type === 'warn');
      if (!modCase) return null;
      modCase.active = false;
      modCase.cleared_by = actorId;
      modCase.clear_reason = reason ?? 'No reason provided.';
      modCase.updated_at = Date.now();
      persist();
      return clone(modCase);
    }
  },
  twitchLiveStates: {
    get(login) {
      return clone(state.twitch_live_states.find((row) => row.login === login.toLowerCase()) ?? null);
    },
    upsert(row) {
      const login = row.login.toLowerCase();
      const existing = state.twitch_live_states.find((item) => item.login === login);
      const now = Date.now();
      if (existing) {
        Object.assign(existing, row, {
          login,
          updated_at: now
        });
        persist();
        return clone(existing);
      }
      const liveState = {
        login,
        display_name: row.display_name ?? row.login,
        is_live: Boolean(row.is_live),
        stream_id: row.stream_id ?? null,
        notified_stream_id: row.notified_stream_id ?? null,
        title: row.title ?? null,
        game_name: row.game_name ?? null,
        started_at: row.started_at ?? null,
        last_seen_at: row.last_seen_at ?? now,
        updated_at: now
      };
      state.twitch_live_states.push(liveState);
      persist();
      return clone(liveState);
    },
    all() {
      return clone(state.twitch_live_states);
    }
  },
  rulesAcceptances: {
    upsert(row) {
      const now = row.acceptedAt ?? Date.now();
      const existing = state.rules_acceptances.find((item) =>
        item.discord_id === row.discordId &&
        item.type === row.type
      );
      if (existing) {
        existing.role_id = row.roleId ?? existing.role_id ?? null;
        existing.accepted_at = now;
        existing.source = row.source ?? existing.source ?? 'discord';
        persist();
        return clone(existing);
      }
      const acceptance = {
        id: state.counters.rules_acceptances++,
        discord_id: row.discordId,
        type: row.type,
        role_id: row.roleId ?? null,
        accepted_at: now,
        source: row.source ?? 'discord'
      };
      state.rules_acceptances.push(acceptance);
      persist();
      return clone(acceptance);
    }
  },
  roleAssignments: {
    upsert(row) {
      const now = row.updatedAt ?? Date.now();
      const existing = state.role_assignments.find((item) =>
        item.discord_id === row.discordId &&
        item.role_id === row.roleId
      );
      if (existing) {
        existing.enabled = Boolean(row.enabled);
        existing.updated_at = now;
        persist();
        return clone(existing);
      }
      const assignment = {
        id: state.counters.role_assignments++,
        discord_id: row.discordId,
        role_id: row.roleId,
        key: row.key,
        enabled: Boolean(row.enabled),
        updated_at: now
      };
      state.role_assignments.push(assignment);
      persist();
      return clone(assignment);
    }
  },
  rolePanelMessages: {
    create(row) {
      const panel = {
        id: state.counters.role_panel_messages++,
        type: row.type,
        channel_id: row.channelId,
        message_id: row.messageId,
        created_by: row.createdBy,
        created_at: row.createdAt ?? Date.now()
      };
      state.role_panel_messages.push(panel);
      persist();
      return clone(panel);
    }
  },
  notificationPreviews: {
    create(row) {
      const preview = {
        id: state.counters.notification_previews++,
        title: row.title,
        message: row.message,
        style: row.style,
        footer: row.footer ?? null,
        button_text: row.buttonText ?? null,
        button_url: row.buttonUrl ?? null,
        created_by: row.createdBy,
        created_at: row.createdAt ?? Date.now(),
        preview_channel_id: row.previewChannelId,
        preview_message_id: row.previewMessageId ?? null,
        published_at: null,
        published_by: null,
        published_channel_id: null,
        published_message_id: null,
        notified_role_ids: []
      };
      state.notification_previews.push(preview);
      persist();
      return clone(preview);
    },
    setPreviewMessage(row) {
      const preview = state.notification_previews.find((item) => item.id === row.id);
      if (!preview) return null;
      preview.preview_message_id = row.messageId;
      persist();
      return clone(preview);
    },
    get(id) {
      return clone(state.notification_previews.find((item) => item.id === id) ?? null);
    },
    markPublished(row) {
      const preview = state.notification_previews.find((item) => item.id === row.id);
      if (!preview) return null;
      preview.published_at = row.publishedAt ?? Date.now();
      preview.published_by = row.publishedBy;
      preview.published_channel_id = row.channelId;
      preview.published_message_id = row.messageId;
      preview.notified_role_ids = row.roleIds ?? [];
      persist();
      return clone(preview);
    }
  },
  adminSessions: {
    create(row) {
      const now = Date.now();
      const session = {
        id: row.id,
        discord_id: row.discordId,
        username: row.username,
        display_name: row.displayName,
        avatar_url: row.avatarUrl ?? null,
        created_at: now,
        expires_at: row.expiresAt,
        last_seen_at: now
      };
      state.admin_sessions = state.admin_sessions.filter((item) => item.id !== session.id);
      state.admin_sessions.push(session);
      persist();
      return clone(session);
    },
    get(id) {
      const session = state.admin_sessions.find((row) => row.id === id);
      if (!session) return null;
      if (Date.now() >= session.expires_at) {
        state.admin_sessions = state.admin_sessions.filter((row) => row.id !== id);
        persist();
        return null;
      }
      session.last_seen_at = Date.now();
      persist();
      return clone(session);
    },
    delete(id) {
      const previousLength = state.admin_sessions.length;
      state.admin_sessions = state.admin_sessions.filter((row) => row.id !== id);
      if (state.admin_sessions.length !== previousLength) persist();
    }
  },
  snapshot: {
    get() {
      return clone(state);
    }
  }
};
