import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const dbPath = join(process.cwd(), 'data', 'lifesteal-bot.json');
const backupDirectory = join(process.cwd(), 'data', 'backups');
mkdirSync(dirname(dbPath), { recursive: true });

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
  appeals: [],
  staff_notes: [],
  shared_ip_exceptions: [],
  ticket_threads: [],
  app_settings: {},
  overlay_lifesteal_player: null,
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
  nextNoteId: 1,
  nextTicketId: 1
};

function load() {
  if (!existsSync(dbPath)) return structuredClone(initialState);
  return { ...structuredClone(initialState), ...JSON.parse(readFileSync(dbPath, 'utf8')) };
}

const state = load();

function persist() {
  writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

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
  upsertLinked: {
    run(row) {
      const existingMinecraft = state.linked_accounts.find(
        (item) => item.minecraft_uuid === row.minecraftUuid && item.discord_id !== row.discordId
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
        status: row.status,
        suspicious: row.suspicious,
        suspicious_reason: row.suspiciousReason,
        risk_score: row.riskScore ?? existingLinked?.risk_score ?? 0,
        risk_band: row.riskBand ?? existingLinked?.risk_band ?? 'low',
        risk_reasons: row.riskReasons ?? existingLinked?.risk_reasons ?? [],
        role: row.role ?? 'player',
        public_stats_opt_in: row.publicStatsOptIn ?? existingLinked?.public_stats_opt_in ?? false,
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
  setLinkedStatus: {
    run(row) {
      const linked = state.linked_accounts.find((item) => item.discord_id === row.discordId);
      if (!linked) return;
      linked.status = row.status;
      linked.suspicious = row.suspicious;
      linked.suspicious_reason = row.reason;
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
      linked.region = row.region ?? linked.region ?? null;
      linked.team_name = row.teamName ?? linked.team_name ?? null;
      linked.event_interest = row.eventInterest ?? linked.event_interest ?? null;
      linked.role = row.role ?? linked.role ?? 'player';
      linked.public_stats_opt_in = row.publicStatsOptIn ?? linked.public_stats_opt_in ?? false;
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
