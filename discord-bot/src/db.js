import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const dbPath = join(process.cwd(), 'data', 'lifesteal-bot.json');
const backupDirectory = join(process.cwd(), 'data', 'backups');
mkdirSync(dirname(dbPath), { recursive: true });

const hardcodedOwnerDiscordIds = new Set(['1248919319967039498']);

function isHardcodedOwnerDiscordId(discordId) {
  return hardcodedOwnerDiscordIds.has(String(discordId ?? ''));
}

const initialState = {
  linked_accounts: [],
  verification_tokens: [],
  moderation_cases: [],
  audit_events: [],
  minecraft_link_history: [],
  minecraft_name_history: [],
  discord_name_history: [],
  rules_acceptances: [],
  signup_answers: [],
  support_rule_acknowledgements: [],
  support_applications: [],
  support_submissions: [],
  lifesteal_events: [],
  admin_staff_access: [],
  appeals: [],
  staff_notes: [],
  shared_ip_exceptions: [],
  ticket_threads: [],
  notification_previews: [],
  app_settings: {},
  overlay_lifesteal_player: null,
  server_status: {
    latest: null,
    history: [],
    alert_state: {}
  },
  public_lifesteal_snapshot: {
    schema_version: 2,
    status: {
      online_players: null,
      max_players: null,
      grace_active: false,
      grace_paused: false,
      grace_remaining_seconds: null,
      source_updated_at: null,
      snapshot_age_seconds: null,
      updated_at: null
    },
    players: [],
    objectives: {
      dragon_egg: null,
      maces: [],
      twenty_hearts: null
    },
    season: null,
    updated_at: null
  },
  nextCaseId: 1,
  nextAuditId: 1,
  nextAppealId: 1,
  nextSupportRuleAckId: 1,
  nextSupportApplicationId: 1,
  nextSupportSubmissionId: 1,
  nextLifestealEventId: 1,
  nextAdminStaffAccessId: 1,
  nextNoteId: 1,
  nextTicketId: 1,
  nextNotificationPreviewId: 1
};

const defaultLifestealEventsSeedVersion = 'season-1-events-2026-06-15';
const seasonOneStartAt = Date.UTC(2026, 6, 1, 10, 0, 0);
const defaultLifestealEvents = [
  {
    title: 'Event Start',
    starts_at: seasonOneStartAt,
    ends_at: null,
    type: 'Server Start',
    reward: 'Season 1 begins',
    objective: 'The server opens for the first public Season 1 session.',
    summary: 'The countdown to Season 1. We are looking forward to starting the server together at this time.',
    priority: 0
  },
  {
    title: 'Grace Period',
    starts_at: seasonOneStartAt,
    ends_at: seasonOneStartAt + 60 * 60 * 1000,
    type: 'Protection Window',
    reward: 'Safe first hour',
    objective: 'PvP, combat tags, lifesteal, heart loss, eliminations, and revivals stay disabled for the first hour.',
    summary: 'The first hour gives players time to spread out, prepare, and settle into the season before combat turns on.',
    priority: 1
  },
  {
    title: 'End Opening',
    starts_at: seasonOneStartAt + 7 * 24 * 60 * 60 * 1000,
    ends_at: null,
    type: 'End Event',
    reward: 'Dragon Egg race begins',
    objective: 'The End opens exactly seven days after server start.',
    summary: 'The first major objective fight opens the End and begins the race for the Dragon Egg.',
    priority: 0
  },
  {
    title: 'Dragon Egg = Mace',
    starts_at: seasonOneStartAt + 7 * 24 * 60 * 60 * 1000,
    ends_at: seasonOneStartAt + 9 * 24 * 60 * 60 * 1000,
    type: 'Objective Challenge',
    reward: 'Mace conversion',
    objective: 'Survive the End fight, carry the egg out of the End, and stay alive for 48 hours.',
    summary: 'Survive the End fight, carry the egg out of the End, and stay alive for 48 hours!',
    priority: 1
  }
];

function load() {
  if (!existsSync(dbPath)) return structuredClone(initialState);
  return { ...structuredClone(initialState), ...JSON.parse(readFileSync(dbPath, 'utf8')) };
}

const state = load();

function seedDefaultLifestealEvents() {
  state.app_settings ??= {};
  if (state.app_settings.default_lifesteal_events_seeded === defaultLifestealEventsSeedVersion) return;
  const existingTitles = new Set(state.lifesteal_events.map((event) => String(event.title ?? '').trim().toLowerCase()));
  const now = Date.now();
  for (const event of defaultLifestealEvents) {
    if (existingTitles.has(event.title.toLowerCase())) continue;
    state.lifesteal_events.push({
      id: state.nextLifestealEventId++,
      ...event,
      status: 'scheduled',
      public: true,
      announce: false,
      announcement_message_id: null,
      created_by: 'system:default-schedule',
      created_at: now,
      updated_by: 'system:default-schedule',
      updated_at: now
    });
  }
  state.app_settings.default_lifesteal_events_seeded = defaultLifestealEventsSeedVersion;
  persist();
}

function persist() {
  writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

seedDefaultLifestealEvents();

function upsertBy(table, key, row) {
  const index = state[table].findIndex((item) => item[key] === row[key]);
  if (index === -1) state[table].push(row);
  else state[table][index] = { ...state[table][index], ...row };
  persist();
}

function auditHash(row) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      id: row.id,
      type: row.type,
      discord_id: row.discord_id,
      minecraft_uuid: row.minecraft_uuid,
      ip_hash: row.ip_hash,
      data_json: row.data_json,
      created_at: row.created_at,
      previous_hash: row.previous_hash
    }))
    .digest('hex');
}

export const db = {
  transaction(fn) {
    return (...args) => fn(...args);
  }
};

export const statements = {
  createToken: {
    run(row) {
      upsertBy('verification_tokens', 'token', {
        token: row.token,
        link_code: row.linkCode ?? null,
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        minecraft_name: row.minecraftName,
        created_at: row.createdAt,
        expires_at: row.expiresAt,
        used_at: null
      });
    }
  },
  getToken: {
    get(token) {
      return state.verification_tokens.find((row) => row.token === token) ?? null;
    }
  },
  getTokenByLinkCode: {
    get(linkCode) {
      return state.verification_tokens.find((row) => row.link_code === linkCode) ?? null;
    }
  },
  markTokenUsed: {
    run(usedAt, token) {
      const row = state.verification_tokens.find((item) => item.token === token);
      if (row) {
        row.used_at = usedAt;
        persist();
      }
    }
  },
  findLinkedByDiscord: {
    get(discordId) {
      return state.linked_accounts.find((row) => row.discord_id === discordId) ?? null;
    }
  },
  findLinkedByMinecraft: {
    get(minecraftUuid) {
      return state.linked_accounts.find((row) => row.minecraft_uuid === minecraftUuid) ?? null;
    }
  },
  findLinkedByIp: {
    all(ipHash, discordId) {
      return state.linked_accounts.filter((row) => row.ip_hash === ipHash && row.discord_id !== discordId);
    }
  },
  findLinkedAccounts: {
    all() {
      return [...state.linked_accounts];
    }
  },
  deleteLinkedAccount: {
    run(discordId) {
      if (isHardcodedOwnerDiscordId(discordId)) return null;
      const index = state.linked_accounts.findIndex((row) => row.discord_id === discordId);
      if (index === -1) return null;
      const [deleted] = state.linked_accounts.splice(index, 1);
      persist();
      return deleted;
    }
  },
  upsertLinked: {
    run(row) {
      const protectedOwner = isHardcodedOwnerDiscordId(row.discordId);
      const existingMinecraft = state.linked_accounts.find(
        (item) => sameMinecraftUuid(item.minecraft_uuid, row.minecraftUuid) && item.discord_id !== row.discordId
      );
      if (existingMinecraft) throw new Error('Minecraft account is already linked to another Discord account.');
      const existingLinked = state.linked_accounts.find((item) => item.discord_id === row.discordId);

      upsertBy('linked_accounts', 'discord_id', {
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        minecraft_name: row.minecraftName,
        discord_username: row.discordUsername ?? null,
        ip_hash: row.ipHash ?? existingLinked?.ip_hash ?? null,
        ip_prefix_hash: row.ipPrefixHash ?? existingLinked?.ip_prefix_hash ?? null,
        verified_at: row.verifiedAt,
        last_seen_at: row.lastSeenAt,
        status: protectedOwner ? 'active' : row.status,
        suspicious: protectedOwner ? 0 : row.suspicious,
        suspicious_reason: protectedOwner ? 'Hardcoded owner account.' : row.suspiciousReason,
        risk_score: protectedOwner ? 0 : row.riskScore ?? existingLinked?.risk_score ?? 0,
        risk_band: protectedOwner ? 'low' : row.riskBand ?? existingLinked?.risk_band ?? 'low',
        risk_reasons: protectedOwner ? [] : row.riskReasons ?? existingLinked?.risk_reasons ?? [],
        role: protectedOwner ? 'owner' : row.role ?? 'player',
        role_managed_at: protectedOwner ? row.roleManagedAt ?? row.verifiedAt : row.roleManagedAt ?? existingLinked?.role_managed_at ?? null,
        public_stats_opt_in: protectedOwner ? true : row.publicStatsOptIn ?? existingLinked?.public_stats_opt_in ?? false,
        roster_status_updated_at: row.rosterStatusUpdatedAt ?? existingLinked?.roster_status_updated_at ?? row.verifiedAt,
        region: row.region ?? existingLinked?.region ?? null,
        team_name: row.teamName ?? existingLinked?.team_name ?? null,
        event_interest: row.eventInterest ?? existingLinked?.event_interest ?? null
      });

      upsertHistory('discord_name_history', ['discord_id', 'username'], {
        discord_id: row.discordId,
        username: row.discordUsername ?? null,
        first_seen_at: row.verifiedAt,
        last_seen_at: row.verifiedAt
      });
      upsertHistory('minecraft_name_history', ['minecraft_uuid', 'username'], {
        minecraft_uuid: row.minecraftUuid,
        username: row.minecraftName,
        first_seen_at: row.verifiedAt,
        last_seen_at: row.verifiedAt
      });
      state.minecraft_link_history.push({
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        minecraft_name: row.minecraftName,
        linked_at: row.verifiedAt
      });
      persist();
    }
  },
  updateLinkedMinecraftIdentity: {
    run(row) {
      const linked = state.linked_accounts.find((item) => item.discord_id === row.discordId);
      if (!linked) return null;
      const existingMinecraft = state.linked_accounts.find(
        (item) => sameMinecraftUuid(item.minecraft_uuid, row.minecraftUuid) && item.discord_id !== row.discordId
      );
      if (existingMinecraft) throw new Error('Minecraft account is already linked to another Discord account.');

      linked.minecraft_uuid = row.minecraftUuid;
      linked.minecraft_name = row.minecraftName ?? linked.minecraft_name;
      linked.last_seen_at = row.seenAt ?? Date.now();
      upsertHistory('minecraft_name_history', ['minecraft_uuid', 'username'], {
        minecraft_uuid: linked.minecraft_uuid,
        username: linked.minecraft_name,
        first_seen_at: linked.last_seen_at,
        last_seen_at: linked.last_seen_at
      });
      state.minecraft_link_history.push({
        discord_id: linked.discord_id,
        minecraft_uuid: linked.minecraft_uuid,
        minecraft_name: linked.minecraft_name,
        linked_at: linked.last_seen_at
      });
      persist();
      return linked;
    }
  },
  setLinkedStatus: {
    run(row) {
      const linked = state.linked_accounts.find((item) => item.discord_id === row.discordId);
      if (!linked) return;
      if (isHardcodedOwnerDiscordId(row.discordId)) return;
      const statusChanged = linked.status !== row.status;
      linked.status = row.status;
      linked.suspicious = row.suspicious;
      linked.suspicious_reason = row.reason;
      if (statusChanged && row.rosterStatusUpdatedAt) {
        linked.roster_status_updated_at = row.rosterStatusUpdatedAt;
      }
      persist();
    }
  },
  addCase: {
    run(row) {
      state.moderation_cases.push({
        id: state.nextCaseId++,
        action: row.action,
        target_discord_id: row.targetDiscordId,
        target_minecraft_uuid: row.targetMinecraftUuid,
        moderator_id: row.moderatorId,
        reason: row.reason,
        created_at: row.createdAt,
        closed_at: null,
        closed_by: null,
        close_reason: null
      });
      persist();
    }
  },
  closeCase: {
    run(row) {
      const item = state.moderation_cases.find((caseRow) => caseRow.id === row.caseId);
      if (!item) return null;
      item.closed_at = row.closedAt;
      item.closed_by = row.closedBy;
      item.close_reason = row.reason;
      persist();
      return item;
    }
  },
  findCasesForAccount: {
    all(discordId, minecraftUuid) {
      return state.moderation_cases.filter((row) =>
        (discordId && row.target_discord_id === discordId) ||
        (minecraftUuid && row.target_minecraft_uuid === minecraftUuid)
      );
    }
  },
  addAudit: {
    run(row) {
      const previous = state.audit_events.at(-1);
      const previousHash = previous?.event_hash ?? null;
      const auditRow = {
        id: state.nextAuditId++,
        type: row.type,
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        ip_hash: row.ipHash,
        data_json: row.dataJson,
        created_at: row.createdAt,
        previous_hash: previousHash
      };
      auditRow.event_hash = auditHash(auditRow);
      state.audit_events.push({
        ...auditRow
      });
      persist();
    }
  },
  recentAudit: {
    all(limit) {
      return [...state.audit_events].sort((a, b) => b.created_at - a.created_at).slice(0, limit);
    }
  },
  findAuditForAccount: {
    all(discordId, minecraftUuid) {
      return state.audit_events.filter((row) =>
        (discordId && row.discord_id === discordId) ||
        (minecraftUuid && row.minecraft_uuid === minecraftUuid)
      );
    }
  },
  findLinkedByPrefix: {
    all(ipPrefixHash, discordId) {
      return state.linked_accounts.filter((row) => row.ip_prefix_hash === ipPrefixHash && row.discord_id !== discordId);
    }
  },
  findLinkedByIpAny: {
    all(ipHash) {
      return state.linked_accounts.filter((row) => row.ip_hash === ipHash);
    }
  },
  findLinkedByPrefixAny: {
    all(ipPrefixHash) {
      return state.linked_accounts.filter((row) => row.ip_prefix_hash === ipPrefixHash);
    }
  },
  findMinecraftHistory: {
    all(minecraftUuid) {
      return state.minecraft_link_history.filter((row) => row.minecraft_uuid === minecraftUuid);
    }
  },
  recordDiscordName: {
    run(row) {
      upsertHistory('discord_name_history', ['discord_id', 'username'], {
        discord_id: row.discordId,
        username: row.username,
        first_seen_at: row.seenAt,
        last_seen_at: row.seenAt
      });
    }
  },
  recordMinecraftName: {
    run(row) {
      upsertHistory('minecraft_name_history', ['minecraft_uuid', 'username'], {
        minecraft_uuid: row.minecraftUuid,
        username: row.username,
        first_seen_at: row.seenAt,
        last_seen_at: row.seenAt
      });
    }
  },
  findDiscordNameHistory: {
    all(discordId) {
      return state.discord_name_history.filter((row) => row.discord_id === discordId);
    }
  },
  findMinecraftNameHistory: {
    all(minecraftUuid) {
      return state.minecraft_name_history.filter((row) => row.minecraft_uuid === minecraftUuid);
    }
  },
  upsertRisk: {
    run(row) {
      const linked = state.linked_accounts.find((item) => item.discord_id === row.discordId);
      if (!linked) return;
      linked.risk_score = row.score;
      linked.risk_band = row.band;
      linked.risk_reasons = row.reasons;
      persist();
    }
  },
  updateProfile: {
    run(row) {
      const linked = state.linked_accounts.find((item) => item.discord_id === row.discordId);
      if (!linked) return null;
      if (isHardcodedOwnerDiscordId(row.discordId)) return structuredClone(linked);
      linked.region = row.region ?? linked.region ?? null;
      linked.team_name = row.teamName ?? linked.team_name ?? null;
      linked.event_interest = row.eventInterest ?? linked.event_interest ?? null;
      linked.role = row.role ?? linked.role ?? 'player';
      linked.public_stats_opt_in = row.publicStatsOptIn ?? linked.public_stats_opt_in ?? false;
      persist();
      return linked;
    }
  },
  updateLinkedAdminProfile: {
    run(row) {
      const linked = state.linked_accounts.find((item) => item.discord_id === row.discordId);
      if (!linked) return null;
      if (isHardcodedOwnerDiscordId(row.discordId)) return structuredClone(linked);
      if (row.role !== undefined) {
        linked.role = row.role;
        linked.role_managed_at = row.updatedAt;
      }
      if (row.publicStatsOptIn !== undefined) linked.public_stats_opt_in = row.publicStatsOptIn;
      if (row.status !== undefined) {
        const statusChanged = linked.status !== row.status;
        linked.status = row.status;
        if (statusChanged) linked.roster_status_updated_at = row.updatedAt;
      }
      if (row.suspicious !== undefined) linked.suspicious = row.suspicious;
      if (row.reason !== undefined) linked.suspicious_reason = row.reason;
      persist();
      return linked;
    }
  },
  upsertRulesAcceptance: {
    run(row) {
      upsertBy('rules_acceptances', 'discord_id', {
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        rules_version: row.rulesVersion,
        accepted_at: row.acceptedAt,
        source: row.source
      });
    }
  },
  findRulesAcceptance: {
    get(discordId) {
      return state.rules_acceptances.find((row) => row.discord_id === discordId) ?? null;
    }
  },
  upsertSignupAnswers: {
    run(row) {
      upsertBy('signup_answers', 'discord_id', {
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        minecraft_name: row.minecraftName,
        lifesteal_experience: row.lifestealExperience,
        found_server: row.foundServer,
        timezone: row.timezone,
        understands_pvp: row.understandsPvp,
        rules_agreement: row.rulesAgreement,
        extra: row.extra,
        submitted_at: row.submittedAt
      });
    }
  },
  findSignupAnswers: {
    get(discordId) {
      return state.signup_answers.find((row) => row.discord_id === discordId) ?? null;
    }
  },
  createSupportRuleAcknowledgement: {
    run(row) {
      const ack = {
        id: state.nextSupportRuleAckId++,
        code: row.code,
        project: row.project,
        rules_version: row.rulesVersion,
        created_at: row.createdAt,
        expires_at: row.expiresAt,
        used_at: null,
        application_id: null
      };
      state.support_rule_acknowledgements.push(ack);
      persist();
      return ack;
    }
  },
  findSupportRuleAcknowledgementByCode: {
    get(code) {
      return state.support_rule_acknowledgements.find((row) => row.code === code) ?? null;
    }
  },
  createSupportApplication: {
    run(row) {
      const application = {
        id: state.nextSupportApplicationId++,
        code: row.code,
        project: row.project,
        game: row.game,
        form_type: row.formType,
        rules_ack_id: row.rulesAckId,
        rules_code: row.rulesCode,
        rules_version: row.rulesVersion,
        discord_username: row.discordUsername,
        discord_id_claimed: row.discordIdClaimed ?? null,
        discord_id_verified: null,
        minecraft_name: row.minecraftName,
        answers: row.answers,
        status: 'submitted',
        created_at: row.createdAt,
        ticket_thread_id: null,
        verified_at: null
      };
      state.support_applications.push(application);

      const ack = state.support_rule_acknowledgements.find((item) => item.id === row.rulesAckId);
      if (ack) {
        ack.used_at = row.createdAt;
        ack.application_id = application.id;
      }

      persist();
      return application;
    }
  },
  findSupportApplicationByCode: {
    get(code) {
      return state.support_applications.find((row) => row.code === code) ?? null;
    }
  },
  findSupportApplicationByThread: {
    get(threadId) {
      return state.support_applications.find((row) => row.ticket_thread_id === threadId) ?? null;
    }
  },
  findReviewableSupportApplications: {
    all() {
      return state.support_applications.filter((row) =>
        row.discord_id_verified &&
        row.ticket_thread_id &&
        ['ticket_verified', 'approved_whitelist_pending'].includes(row.status)
      );
    }
  },
  findOpenSupportApplication: {
    get({ minecraftName, discordId, discordUsername }) {
      const openStatuses = new Set(['submitted', 'ticket_verified', 'approved_whitelist_pending']);
      const normalizedMinecraftName = String(minecraftName ?? '').trim().toLowerCase();
      const normalizedDiscordId = String(discordId ?? '').trim();
      const normalizedDiscordUsername = String(discordUsername ?? '').trim().replace(/^@/, '').toLowerCase();

      return state.support_applications.find((row) => {
        if (!openStatuses.has(row.status)) return false;
        if (normalizedMinecraftName && String(row.minecraft_name ?? '').trim().toLowerCase() === normalizedMinecraftName) return true;
        if (normalizedDiscordId && String(row.discord_id_claimed ?? '').trim() === normalizedDiscordId) return true;
        return normalizedDiscordUsername &&
          String(row.discord_username ?? '').trim().replace(/^@/, '').toLowerCase() === normalizedDiscordUsername;
      }) ?? null;
    }
  },
  findPublicSupportApplications: {
    all() {
      return state.support_applications.filter((row) =>
        row.discord_id_verified &&
        row.ticket_thread_id &&
        ['ticket_verified', 'approved_whitelist_pending'].includes(row.status)
      );
    }
  },
  claimSupportApplicationTicket: {
    run(row) {
      const application = state.support_applications.find((item) => item.code === row.code);
      if (!application) return null;
      application.status = row.status;
      application.discord_id_verified = row.discordId;
      application.ticket_thread_id = row.threadId;
      application.verified_at = row.verifiedAt;
      persist();
      return application;
    }
  },
  updateSupportApplicationStatus: {
    run(row) {
      const application = state.support_applications.find((item) => item.code === row.code);
      if (!application) return null;
      application.status = row.status;
      application.reviewed_at = row.reviewedAt;
      application.reviewed_by = row.reviewedBy;
      application.review_reason = row.reason;
      persist();
      return application;
    }
  },
  removeSupportApplicationFromRoster: {
    run(row) {
      const application = state.support_applications.find((item) => item.code === row.code);
      if (!application) return null;
      application.status = 'removed_from_roster';
      application.reviewed_at = row.reviewedAt;
      application.reviewed_by = row.reviewedBy;
      application.review_reason = row.reason;
      persist();
      return application;
    }
  },
  createSupportSubmission: {
    run(row) {
      const submission = {
        id: state.nextSupportSubmissionId++,
        code: row.code,
        project: row.project,
        game: row.game,
        form_type: row.formType,
        discord_username: row.discordUsername,
        minecraft_name: row.minecraftName ?? null,
        subject_name: row.subjectName ?? null,
        category: row.category,
        summary: row.summary,
        answers: row.answers,
        requires_ticket: Boolean(row.requiresTicket),
        status: 'submitted',
        created_at: row.createdAt,
        ticket_thread_id: null,
        claimed_by: null,
        claimed_at: null,
        reviewed_at: null,
        reviewed_by: null,
        review_reason: null,
        notes: []
      };
      state.support_submissions.push(submission);
      persist();
      return submission;
    }
  },
  findSupportSubmissionByCode: {
    get(code) {
      return state.support_submissions.find((row) => row.code === code) ?? null;
    }
  },
  claimSupportSubmission: {
    run(row) {
      const submission = state.support_submissions.find((item) => item.code === row.code);
      if (!submission) return { ok: false, reason: 'not_found', submission: null };
      if (submission.claimed_by && submission.claimed_by !== row.staffId) {
        return { ok: false, reason: 'claimed', submission };
      }
      if (submission.claimed_by === row.staffId) {
        return { ok: true, changed: false, submission };
      }
      submission.claimed_by = row.staffId;
      submission.claimed_at = row.claimedAt;
      if (submission.status === 'submitted' || submission.status === 'ticket_verified') {
        submission.status = 'in_review';
      }
      persist();
      return { ok: true, changed: true, submission };
    }
  },
  addSupportSubmissionNote: {
    run(row) {
      const submission = state.support_submissions.find((item) => item.code === row.code);
      if (!submission) return null;
      submission.notes ??= [];
      const note = {
        id: state.nextNoteId++,
        author_id: row.authorId,
        text: row.text,
        created_at: row.createdAt
      };
      submission.notes.push(note);
      persist();
      return note;
    }
  },
  updateSupportSubmissionReview: {
    run(row) {
      const submission = state.support_submissions.find((item) => item.code === row.code);
      if (!submission) return null;
      submission.status = row.status;
      submission.reviewed_at = row.reviewedAt;
      submission.reviewed_by = row.reviewedBy;
      submission.review_reason = row.reason;
      if (!submission.claimed_by) {
        submission.claimed_by = row.reviewedBy;
        submission.claimed_at = row.reviewedAt;
      }
      persist();
      return submission;
    }
  },
  findOpenSupportSubmission: {
    get({ formType, discordUsername, minecraftName, subjectName }) {
      const normalizedDiscord = String(discordUsername ?? '').trim().replace(/^@/, '').toLowerCase();
      const normalizedMinecraft = String(minecraftName ?? '').trim().toLowerCase();
      const normalizedSubject = String(subjectName ?? '').trim().toLowerCase();
      return state.support_submissions.find((row) => {
        if (row.form_type !== formType || !['submitted', 'ticket_verified', 'in_review'].includes(row.status)) return false;
        if (normalizedDiscord && String(row.discord_username ?? '').trim().replace(/^@/, '').toLowerCase() === normalizedDiscord) return true;
        if (normalizedMinecraft && String(row.minecraft_name ?? '').trim().toLowerCase() === normalizedMinecraft) return true;
        return normalizedSubject && String(row.subject_name ?? '').trim().toLowerCase() === normalizedSubject;
      }) ?? null;
    }
  },
  createAppeal: {
    run(row) {
      const appeal = {
        id: state.nextAppealId++,
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        ban_id: row.banId ?? null,
        reason: row.reason,
        status: 'open',
        created_at: row.createdAt,
        closed_at: null,
        closed_by: null,
        decision_reason: null
      };
      state.appeals.push(appeal);
      persist();
      return appeal;
    }
  },
  findAppealsForAccount: {
    all(discordId, minecraftUuid) {
      return state.appeals.filter((row) =>
        (discordId && row.discord_id === discordId) ||
        (minecraftUuid && row.minecraft_uuid === minecraftUuid)
      );
    }
  },
  updateAppeal: {
    run(row) {
      const appeal = state.appeals.find((item) => item.id === row.appealId);
      if (!appeal) return null;
      appeal.status = row.status;
      appeal.closed_at = row.closedAt;
      appeal.closed_by = row.closedBy;
      appeal.decision_reason = row.reason;
      persist();
      return appeal;
    }
  },
  addStaffNote: {
    run(row) {
      const note = {
        id: state.nextNoteId++,
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid,
        author_id: row.authorId,
        text: row.text,
        created_at: row.createdAt
      };
      state.staff_notes.push(note);
      persist();
      return note;
    }
  },
  deleteStaffNote: {
    run(noteId) {
      const index = state.staff_notes.findIndex((row) => row.id === noteId);
      if (index === -1) return null;
      const [deleted] = state.staff_notes.splice(index, 1);
      persist();
      return deleted;
    }
  },
  addSharedIpException: {
    run(row) {
      const users = [row.discordIdA, row.discordIdB].sort();
      const existing = state.shared_ip_exceptions.find((item) =>
        item.discord_id_a === users[0] && item.discord_id_b === users[1]
      );
      if (existing) {
        existing.reason = row.reason;
        existing.approved_by = row.approvedBy;
        existing.approved_at = row.approvedAt;
        persist();
        return existing;
      }

      const exception = {
        discord_id_a: users[0],
        discord_id_b: users[1],
        reason: row.reason,
        approved_by: row.approvedBy,
        approved_at: row.approvedAt
      };
      state.shared_ip_exceptions.push(exception);
      persist();
      return exception;
    }
  },
  findSharedIpExceptionsForUser: {
    all(discordId) {
      return state.shared_ip_exceptions.filter((row) => row.discord_id_a === discordId || row.discord_id_b === discordId);
    }
  },
  hasSharedIpException: {
    get(discordIdA, discordIdB) {
      const users = [discordIdA, discordIdB].sort();
      return state.shared_ip_exceptions.find((row) => row.discord_id_a === users[0] && row.discord_id_b === users[1]) ?? null;
    }
  },
  createTicketThread: {
    run(row) {
      const ticket = {
        id: state.nextTicketId++,
        type: row.type,
        thread_id: row.threadId,
        channel_id: row.channelId,
        discord_id: row.discordId,
        minecraft_uuid: row.minecraftUuid ?? null,
        minecraft_name: row.minecraftName ?? null,
        status: 'open',
        step: row.step ?? 0,
        answers: row.answers ?? {},
        created_at: row.createdAt,
        claimed_by: null,
        claimed_at: null,
        closed_at: null
      };
      state.ticket_threads.push(ticket);
      persist();
      return ticket;
    }
  },
  findTicketByThread: {
    get(threadId) {
      return state.ticket_threads.find((row) => row.thread_id === threadId && row.status === 'open') ?? null;
    }
  },
  findOpenTicketForUser: {
    get(discordId, type) {
      return state.ticket_threads.find((row) => row.discord_id === discordId && row.type === type && row.status === 'open') ?? null;
    }
  },
  claimTicketReview: {
    run(row) {
      const ticket = state.ticket_threads.find((item) => item.thread_id === row.threadId && item.status === 'open');
      if (!ticket) return { ok: false, reason: 'not_found', ticket: null };
      if (ticket.claimed_by && ticket.claimed_by !== row.staffId) {
        return { ok: false, reason: 'claimed', ticket };
      }
      if (ticket.claimed_by === row.staffId) {
        return { ok: true, changed: false, ticket };
      }
      ticket.claimed_by = row.staffId;
      ticket.claimed_at = row.claimedAt;
      persist();
      return { ok: true, changed: true, ticket };
    }
  },
  updateTicketThread: {
    run(row) {
      const ticket = state.ticket_threads.find((item) => item.thread_id === row.threadId && item.status === 'open');
      if (!ticket) return null;
      ticket.step = row.step ?? ticket.step;
      ticket.answers = row.answers ?? ticket.answers;
      ticket.minecraft_uuid = row.minecraftUuid ?? ticket.minecraft_uuid;
      ticket.minecraft_name = row.minecraftName ?? ticket.minecraft_name;
      persist();
      return ticket;
    }
  },
  closeTicketThread: {
    run(threadId, closedAt = Date.now()) {
      const ticket = state.ticket_threads.find((row) => row.thread_id === threadId && row.status === 'open');
      if (!ticket) return null;
      ticket.status = 'closed';
      ticket.closed_at = closedAt;
      persist();
      return ticket;
    }
  },
  findNotesForAccount: {
    all(discordId, minecraftUuid) {
      return state.staff_notes.filter((row) =>
        (discordId && row.discord_id === discordId) ||
        (minecraftUuid && row.minecraft_uuid === minecraftUuid)
      );
    }
  },
  getSetting: {
    get(key) {
      return state.app_settings[key] ?? null;
    }
  },
  setSetting: {
    run(key, value) {
      state.app_settings[key] = value;
      persist();
    }
  },
  notificationPreviews: {
    create(row) {
      const preview = {
        id: state.nextNotificationPreviewId++,
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
      return structuredClone(preview);
    },
    setPreviewMessage(row) {
      const preview = state.notification_previews.find((item) => item.id === row.id);
      if (!preview) return null;
      preview.preview_message_id = row.messageId;
      persist();
      return structuredClone(preview);
    },
    get(id) {
      return structuredClone(state.notification_previews.find((item) => item.id === id) ?? null);
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
      return structuredClone(preview);
    }
  },
  createLifestealEvent: {
    run(row) {
      const event = {
        id: state.nextLifestealEventId++,
        title: row.title,
        starts_at: row.startsAt,
        ends_at: row.endsAt ?? null,
        type: row.type,
        reward: row.reward ?? '',
        objective: row.objective,
        summary: row.summary,
        priority: row.priority ?? 10,
        status: row.status ?? 'scheduled',
        public: row.public ?? true,
        announce: row.announce ?? false,
        announcement_message_id: row.announcementMessageId ?? null,
        created_by: row.createdBy,
        created_at: row.createdAt,
        updated_by: row.updatedBy ?? row.createdBy,
        updated_at: row.updatedAt ?? row.createdAt
      };
      state.lifesteal_events.push(event);
      persist();
      return event;
    }
  },
  updateLifestealEvent: {
    run(row) {
      const event = state.lifesteal_events.find((item) => item.id === row.id);
      if (!event) return null;
      for (const key of ['title', 'starts_at', 'ends_at', 'type', 'reward', 'objective', 'summary', 'priority', 'status', 'public', 'announce', 'announcement_message_id']) {
        if (row[key] !== undefined) event[key] = row[key];
      }
      event.updated_by = row.updatedBy;
      event.updated_at = row.updatedAt;
      persist();
      return event;
    }
  },
  deleteLifestealEvent: {
    run(id) {
      const index = state.lifesteal_events.findIndex((event) => event.id === id);
      if (index === -1) return null;
      const [event] = state.lifesteal_events.splice(index, 1);
      persist();
      return event;
    }
  },
  findAdminStaffAccess: {
    all() {
      return structuredClone(state.admin_staff_access.filter((row) => !row.deleted_at));
    }
  },
  findAdminStaffAccessById: {
    get(id) {
      const raw = String(id ?? '');
      if (/^\d{10,30}$/.test(raw)) {
        const byDiscord = state.admin_staff_access.find((row) => row.discord_id === raw && !row.deleted_at);
        if (byDiscord) return structuredClone(byDiscord);
      }
      const numeric = Number(raw);
      if (Number.isFinite(numeric)) {
        return structuredClone(state.admin_staff_access.find((row) => row.id === numeric && !row.deleted_at) ?? null);
      }
      return structuredClone(state.admin_staff_access.find((row) => row.discord_id === raw && !row.deleted_at) ?? null);
    }
  },
  createAdminStaffAccess: {
    run(row) {
      const protectedOwner = isHardcodedOwnerDiscordId(row.discordId);
      const existing = row.discordId
        ? state.admin_staff_access.find((item) => item.discord_id === row.discordId && !item.deleted_at)
        : null;
      const now = row.createdAt ?? Date.now();
      if (existing) {
        Object.assign(existing, {
          display_name: row.displayName,
          role: protectedOwner ? 'Owner' : row.role,
          workspaces: protectedOwner ? ['global', 'lifesteal', 'general', 'valorant'] : row.workspaces,
          status: protectedOwner ? 'Active' : row.status,
          trust: protectedOwner ? 'Full' : row.trust,
          notes: protectedOwner ? 'Hardcoded owner access. This account cannot be changed or removed by staff.' : row.notes,
          updated_by: row.createdBy,
          updated_at: now
        });
        persist();
        return structuredClone(existing);
      }
      const item = {
        id: state.nextAdminStaffAccessId++,
        discord_id: row.discordId ?? null,
        display_name: row.displayName,
        role: protectedOwner ? 'Owner' : row.role,
        workspaces: protectedOwner ? ['global', 'lifesteal', 'general', 'valorant'] : row.workspaces,
        status: protectedOwner ? 'Active' : row.status,
        trust: protectedOwner ? 'Full' : row.trust,
        notes: protectedOwner ? 'Hardcoded owner access. This account cannot be changed or removed by staff.' : row.notes,
        created_by: row.createdBy,
        created_at: now,
        updated_by: row.createdBy,
        updated_at: now,
        deleted_at: null,
        deleted_by: null
      };
      state.admin_staff_access.push(item);
      persist();
      return structuredClone(item);
    }
  },
  updateAdminStaffAccess: {
    run(row) {
      const numeric = Number(row.id);
      let item = Number.isFinite(numeric)
        ? state.admin_staff_access.find((entry) => entry.id === numeric && !entry.deleted_at)
        : null;
      if (!item && row.discordId) {
        item = state.admin_staff_access.find((entry) => entry.discord_id === row.discordId && !entry.deleted_at);
      }
      const protectedOwner = isHardcodedOwnerDiscordId(row.discordId) || isHardcodedOwnerDiscordId(item?.discord_id);
      if (!item && row.createIfMissing) {
        item = {
          id: state.nextAdminStaffAccessId++,
          discord_id: row.discordId ?? null,
          display_name: row.displayName,
          role: protectedOwner ? 'Owner' : row.role,
          workspaces: protectedOwner ? ['global', 'lifesteal', 'general', 'valorant'] : row.workspaces,
          status: protectedOwner ? 'Active' : row.status,
          trust: protectedOwner ? 'Full' : row.trust,
          notes: protectedOwner ? 'Hardcoded owner access. This account cannot be changed or removed by staff.' : row.notes,
          created_by: row.updatedBy,
          created_at: row.updatedAt,
          updated_by: row.updatedBy,
          updated_at: row.updatedAt,
          deleted_at: null,
          deleted_by: null
        };
        state.admin_staff_access.push(item);
        persist();
        return structuredClone(item);
      }
      if (!item) return null;
      if (protectedOwner) {
        Object.assign(item, {
          discord_id: item.discord_id ?? row.discordId,
          display_name: row.displayName ?? item.display_name,
          role: 'Owner',
          workspaces: ['global', 'lifesteal', 'general', 'valorant'],
          status: 'Active',
          trust: 'Full',
          notes: 'Hardcoded owner access. This account cannot be changed or removed by staff.',
          updated_by: row.updatedBy,
          updated_at: row.updatedAt
        });
        persist();
        return structuredClone(item);
      }
      for (const key of ['discordId', 'displayName', 'role', 'workspaces', 'status', 'trust', 'notes']) {
        if (row[key] === undefined) continue;
        const targetKey = key === 'discordId' ? 'discord_id' : key === 'displayName' ? 'display_name' : key;
        item[targetKey] = row[key];
      }
      item.updated_by = row.updatedBy;
      item.updated_at = row.updatedAt;
      persist();
      return structuredClone(item);
    }
  },
  deleteAdminStaffAccess: {
    run(row) {
      const numeric = Number(row.id);
      const item = Number.isFinite(numeric)
        ? state.admin_staff_access.find((entry) => entry.id === numeric && !entry.deleted_at)
        : state.admin_staff_access.find((entry) => entry.discord_id === row.id && !entry.deleted_at);
      if (!item) return null;
      if (isHardcodedOwnerDiscordId(row.id) || isHardcodedOwnerDiscordId(item.discord_id)) return null;
      item.deleted_at = row.deletedAt;
      item.deleted_by = row.deletedBy;
      item.updated_at = row.deletedAt;
      item.updated_by = row.deletedBy;
      persist();
      return structuredClone(item);
    }
  },
  snapshot: {
    get() {
      return structuredClone(state);
    }
  },
  backup: {
    run() {
      mkdirSync(backupDirectory, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(backupDirectory, `lifesteal-bot-${stamp}.json`);
      writeFileSync(backupPath, JSON.stringify(state, null, 2));
      return backupPath;
    }
  },
  getOverlayLifestealPlayer: {
    get() {
      return state.overlay_lifesteal_player ? structuredClone(state.overlay_lifesteal_player) : null;
    }
  },
  upsertOverlayLifestealPlayer: {
    run(row) {
      state.overlay_lifesteal_player = {
        minecraft_uuid: row.minecraftUuid,
        minecraft_name: row.minecraftName ?? null,
        hearts: row.hearts ?? null,
        eliminated: Boolean(row.eliminated),
        twenty_hearts: Boolean(row.twentyHearts),
        dragon_egg_holder: Boolean(row.dragonEggHolder),
        mace_wielder: Boolean(row.maceWielder),
        updated_at: row.updatedAt
      };
      persist();
    }
  },
  getPublicLifestealSnapshot: {
    get() {
      return structuredClone(state.public_lifesteal_snapshot);
    }
  },
  upsertPublicLifestealSnapshot: {
    run(row) {
      state.public_lifesteal_snapshot = {
        schema_version: row.schemaVersion ?? 2,
        status: row.status,
        players: row.players,
        objectives: row.objectives,
        season: row.season,
        updated_at: row.updatedAt
      };
      persist();
    }
  },
  upsertServerHeartbeat: {
    run(row) {
      state.server_status ??= { latest: null, history: [], alert_state: {} };
      const heartbeat = structuredClone(row.heartbeat);
      state.server_status.latest = heartbeat;
      state.server_status.history.unshift(heartbeat);
      state.server_status.history = state.server_status.history.slice(0, row.maxHistory);
      persist();
      return structuredClone(state.server_status.latest);
    }
  },
  getServerStatus: {
    get() {
      state.server_status ??= { latest: null, history: [], alert_state: {} };
      return structuredClone(state.server_status);
    }
  },
  setServerAlertState: {
    run(key, value) {
      state.server_status ??= { latest: null, history: [], alert_state: {} };
      state.server_status.alert_state ??= {};
      state.server_status.alert_state[key] = value;
      persist();
    }
  }
};

function upsertHistory(table, keys, row) {
  if (!row[keys[1]]) return;
  const existing = state[table].find((item) => keys.every((key) => item[key] === row[key]));
  if (existing) {
    existing.last_seen_at = row.last_seen_at;
  } else {
    state[table].push(row);
  }
  persist();
}

function sameMinecraftUuid(left, right) {
  if (!left || !right) return false;
  return String(left).toLowerCase().replaceAll('-', '') === String(right).toLowerCase().replaceAll('-', '');
}
