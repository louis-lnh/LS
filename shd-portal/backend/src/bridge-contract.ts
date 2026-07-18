import type {
  AntiCheatAction,
  AntiCheatResolutionStatus,
  ChatSenderType,
  EventRecord,
  EventScheduleEntry,
  JsonValue,
  LinkedDiscordAccount,
  LinkedMinecraftAccount,
  SeverityLevel,
  SubmissionStatus,
  SystemCategory,
  SystemStatus,
  User,
  UserRole,
} from './domain.js'

export type BridgeServiceKey =
  | 'lifesteal-discord-bot'
  | 'main-discord-bot'
  | 'lifesteal-minecraft-server'
  | 'shd-agent-lifesteal-g17'
  | 'lifesteal-website'
  | 'shd-portal'

export type BridgeRequestContext = {
  service: BridgeServiceKey
  requestId: string
  actor?: string
}

export type BridgeIdentityLookupResponse = {
  user: Pick<User, 'id' | 'shdId' | 'displayName' | 'status' | 'publicProfile'> | null
  discordAccount: LinkedDiscordAccount | null
  minecraftAccount: LinkedMinecraftAccount | null
  roles: UserRole[]
}

export type DetectedClientMod = {
  id: string
  name: string
  version?: string | null
  classification: 'blocked' | 'suspicious'
}

export type BridgeAntiCheatRecordInput = {
  evidenceId: string
  appealId?: string | null
  minecraftUuid: string
  minecraftName: string
  shdId?: string | null
  action: AntiCheatAction
  category: string
  severity: SeverityLevel
  reasonCode: string
  publicReason: string
  detectedMods?: DetectedClientMod[]
  context?: JsonValue
  occurredAt: string
  expiresAt?: string | null
}

export type BridgeAntiCheatRecordResult = {
  evidenceId: string
  appealId: string | null
  shdId: string | null
  userId: string | null
  resolutionStatus: AntiCheatResolutionStatus | null
  created: boolean
}

export type BridgeAntiCheatResolveInput = {
  status: Extract<AntiCheatResolutionStatus, 'approved' | 'denied' | 'resolved'>
  resolvedByUserId?: string | null
  resolvedByDiscordId?: string | null
  note?: string | null
}

export type BridgeSupportSubmissionInput = {
  submissionCode: string
  type: 'application' | 'appeal' | 'player_report' | 'general_support'
  workspace: string
  eventCode?: string | null
  shdId?: string | null
  discordId?: string | null
  minecraftUuid?: string | null
  minecraftName?: string | null
  fields: Array<{
    key: string
    label: string
    value: JsonValue
    visibility?: 'staff' | 'user' | 'system'
  }>
  discord?: {
    guildId?: string | null
    channelId?: string | null
    threadId?: string | null
    messageId?: string | null
  }
}

export type BridgeSupportStatusInput = {
  action: 'claimed' | 'accepted' | 'denied' | 'acknowledged' | 'closed' | 'reopened'
  status?: SubmissionStatus
  staffUserId?: string | null
  staffDiscordId?: string | null
  reason?: string | null
  closeAfterHours?: number | null
}

export type BridgeChatMessageInput = {
  senderType: ChatSenderType
  senderUserId?: string | null
  senderDiscordId?: string | null
  body: string
  attachments?: JsonValue[]
  discordMessageId?: string | null
}

export type BridgeEventFeedResponse = {
  targetKey: string
  events: Array<EventRecord & {
    scheduleEntries: EventScheduleEntry[]
  }>
}

export type BridgeSystemHeartbeatInput = {
  systemKey: string
  name?: string
  category?: SystemCategory
  status: SystemStatus
  source: string
  sentAt?: string | null
  metrics?: JsonValue
  issues?: JsonValue[]
}

export type BridgeSystemHeartbeatResult = {
  systemKey: string
  previousStatus: SystemStatus | null
  status: SystemStatus
  statusChanged: boolean
  receivedAt: string
}

export type BridgeEventName =
  | 'identity.linked'
  | 'anticheat.recorded'
  | 'anticheat.resolved'
  | 'support.submission.created'
  | 'support.submission.claimed'
  | 'support.submission.resolved'
  | 'chat.message.created'
  | 'event.published'
  | 'event.archived'
  | 'system.heartbeat.received'
  | 'system.status.changed'
