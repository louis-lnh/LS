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
  role_panel_messages: [],
  settings: {},
  counters: {
    audit_events: 1,
    support_submissions: 1,
    support_notes: 1,
    ticket_threads: 1,
    role_panel_messages: 1
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
      if (submission.status === 'submitted') {
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
