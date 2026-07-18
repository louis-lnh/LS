import type {
  AntiCheatRecord,
  AntiCheatResolutionStatus,
  AuditEvent,
  Chat,
  ChatMessage,
  EventPublishTarget,
  EventRecord,
  EventScheduleEntry,
  LinkedDiscordAccount,
  LinkedMinecraftAccount,
  MonitoredSystem,
  SupportSubmission,
  SystemActionStatus,
  SystemHeartbeat,
  User,
  UserRole,
} from './domain.js'
import type {
  BridgeAntiCheatRecordInput,
  BridgeChatMessageInput,
  BridgeSupportStatusInput,
  BridgeSupportSubmissionInput,
  BridgeSystemHeartbeatInput,
} from './bridge-contract.js'

export type ListEventsFilter = {
  status?: EventRecord['status']
  workspace?: string
  includeArchived?: boolean
}

export type ListSupportFilter = {
  status?: SupportSubmission['status']
  type?: SupportSubmission['type']
  assignedTo?: string | 'me'
}

export type ListUsersFilter = {
  q?: string
  role?: UserRole['role']
  risk?: string
}

export type EventRepository = {
  list(filter?: ListEventsFilter): Promise<Array<EventRecord & { scheduleCount: number }>>
  getByIdOrCode(idOrCode: string): Promise<EventRecord | null>
  getBySlug(slug: string): Promise<EventRecord | null>
  listScheduleEntries(eventId: string): Promise<EventScheduleEntry[]>
  listPublishTargets(eventId: string): Promise<EventPublishTarget[]>
  listPublicForTarget(targetKey: string): Promise<Array<EventRecord & { scheduleEntries: EventScheduleEntry[] }>>
}

export type IdentityRepository = {
  getUserById(id: string): Promise<User | null>
  getUserByShdId(shdId: string): Promise<User | null>
  getDiscordByUserId(userId: string): Promise<LinkedDiscordAccount[]>
  getMinecraftByUserId(userId: string): Promise<LinkedMinecraftAccount[]>
  getMinecraftByUuid(minecraftUuid: string): Promise<LinkedMinecraftAccount | null>
  getPrimaryDiscord(userId: string): Promise<LinkedDiscordAccount | null>
  getRoles(userId: string): Promise<UserRole[]>
  listUsers(filter?: ListUsersFilter): Promise<Array<User & { riskAlerts: number }>>
}

export type SupportRepository = {
  list(filter?: ListSupportFilter): Promise<SupportSubmission[]>
  getByIdOrCode(idOrCode: string): Promise<SupportSubmission | null>
  create(input: BridgeSupportSubmissionInput): Promise<SupportSubmission>
  updateStatus(submissionCode: string, input: BridgeSupportStatusInput): Promise<SupportSubmission | null>
}

export type ChatRepository = {
  getBySubmissionId(submissionId: string): Promise<Chat | null>
  getByCode(chatCode: string): Promise<Chat | null>
  listMessages(chatId: string, limit?: number): Promise<ChatMessage[]>
  createMessage(chatCode: string, input: BridgeChatMessageInput): Promise<ChatMessage>
}

export type AntiCheatRepository = {
  upsertRecord(input: BridgeAntiCheatRecordInput): Promise<AntiCheatRecord & { created: boolean }>
  resolveRecord(input: {
    appealId?: string | null
    evidenceId?: string | null
    status: Extract<AntiCheatResolutionStatus, 'approved' | 'denied' | 'resolved'>
    resolvedBy?: string | null
    note?: string | null
  }): Promise<AntiCheatRecord | null>
  findForAccount(input: { userId?: string | null; shdId?: string | null; minecraftUuid?: string | null; limit?: number }): Promise<AntiCheatRecord[]>
}

export type SystemRepository = {
  list(): Promise<Array<MonitoredSystem & { latestHeartbeat: SystemHeartbeat | null }>>
  getByKey(systemKey: string): Promise<MonitoredSystem | null>
  getLatestHeartbeat(systemId: string): Promise<SystemHeartbeat | null>
  listHeartbeatHistory(systemId: string, limit?: number): Promise<SystemHeartbeat[]>
  recordHeartbeat(input: BridgeSystemHeartbeatInput): Promise<{ system: MonitoredSystem; heartbeat: SystemHeartbeat; previousStatus: MonitoredSystem['status'] | null }>
  listRecentActions(systemId: string, limit?: number): Promise<Array<{
    id: string
    actionType: string
    status: SystemActionStatus
    createdAt: string
    finishedAt: string | null
  }>>
}

export type AuditRepository = {
  create(input: {
    actorUserId?: string | null
    actorExternalId?: string | null
    type: string
    targetType?: string | null
    targetId?: string | null
    data?: unknown
  }): Promise<AuditEvent>
  listForTarget(targetType: string, targetId: string, limit?: number): Promise<AuditEvent[]>
}

export type BackendRepositories = {
  events: EventRepository
  identities: IdentityRepository
  support: SupportRepository
  chats: ChatRepository
  antiCheat: AntiCheatRepository
  systems: SystemRepository
  audit: AuditRepository
}
