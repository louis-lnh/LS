export type AccountStatus = 'active' | 'limited' | 'suspended' | 'deleted'
export type UserRoleName = 'owner' | 'admin' | 'mod' | 'dev' | 'staff' | 'member'
export type EventStatus = 'draft' | 'published' | 'archived' | 'cancelled'
export type PublishTargetType = 'portal' | 'website' | 'discord_bot' | 'minecraft_server' | 'api_feed'
export type SubmissionType = 'application' | 'appeal' | 'player_report' | 'general_support'
export type SubmissionStatus = 'submitted' | 'under_review' | 'waiting_user' | 'accepted' | 'denied' | 'resolved' | 'closed' | 'archived'
export type SubmissionPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ReviewAction = 'claimed' | 'accepted' | 'denied' | 'acknowledged' | 'closed' | 'reopened'
export type ChatType = 'dm' | 'submission' | 'announcement' | 'notification' | 'staff'
export type ChatMemberRole = 'owner' | 'member' | 'staff' | 'viewer'
export type ChatSenderType = 'user' | 'staff' | 'system' | 'discord_bot'
export type AntiCheatAction = 'alert' | 'block_join' | 'kick' | 'temp_ban' | 'ban'
export type SeverityLevel = 'info' | 'warning' | 'critical'
export type AntiCheatResolutionStatus = 'open' | 'approved' | 'denied' | 'resolved'
export type SystemCategory = 'vps' | 'discord_bot' | 'backend' | 'website' | 'minecraft_server' | 'agent'
export type RuntimeEnvironment = 'production' | 'staging' | 'development'
export type SystemStatus = 'healthy' | 'warning' | 'critical' | 'paused' | 'unknown'
export type SystemActionStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export type Timestamp = string
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type User = {
  id: string
  shdId: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  bio: string | null
  status: AccountStatus
  publicProfile: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type UserRole = {
  id: string
  userId: string
  role: UserRoleName
  scope: string
  grantedBy: string | null
  grantedAt: Timestamp
  revokedAt: Timestamp | null
}

export type LinkedDiscordAccount = {
  id: string
  userId: string
  discordId: string
  username: string
  displayName: string | null
  guildId: string | null
  linkedAt: Timestamp
  lastSeenAt: Timestamp | null
  primaryAccount: boolean
}

export type LinkedMinecraftAccount = {
  id: string
  userId: string
  minecraftUuid: string
  minecraftName: string
  linkedAt: Timestamp
  lastSeenAt: Timestamp | null
  primaryAccount: boolean
  publicStatsOptIn: boolean
}

export type EventRecord = {
  id: string
  eventCode: string
  parentEventId: string | null
  workspace: string
  title: string
  slug: string
  category: string
  status: EventStatus
  startsAt: Timestamp | null
  endsAt: Timestamp | null
  timezone: string
  summary: string
  description: string
  publicUrl: string | null
  createdBy: string | null
  updatedBy: string | null
  publishedAt: Timestamp | null
  archivedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type EventScheduleEntry = {
  id: string
  eventId: string
  title: string
  type: string
  startsAt: Timestamp
  endsAt: Timestamp | null
  reward: string | null
  objective: string | null
  summary: string | null
  priority: number
  public: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type EventPublishTarget = {
  id: string
  eventId: string
  targetType: PublishTargetType
  targetKey: string
  enabled: boolean
  lastSyncedAt: Timestamp | null
  lastError: string | null
}

export type SupportSubmission = {
  id: string
  submissionCode: string
  type: SubmissionType
  workspace: string
  eventId: string | null
  userId: string
  status: SubmissionStatus
  priority: SubmissionPriority
  assignedTo: string | null
  claimedAt: Timestamp | null
  closedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type Chat = {
  id: string
  chatCode: string | null
  type: ChatType
  title: string
  submissionId: string | null
  createdBy: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
  archivedAt: Timestamp | null
}

export type ChatMessage = {
  id: string
  chatId: string
  senderUserId: string | null
  senderType: ChatSenderType
  body: string
  attachments: JsonValue[]
  discordMessageId: string | null
  createdAt: Timestamp
  editedAt: Timestamp | null
  deletedAt: Timestamp | null
}

export type AntiCheatRecord = {
  id: string
  evidenceId: string
  appealId: string | null
  userId: string | null
  minecraftAccountId: string | null
  shdId: string | null
  action: AntiCheatAction
  category: string
  severity: SeverityLevel
  reasonCode: string
  publicReason: string
  detectedMods: JsonValue[]
  context: JsonValue
  occurredAt: Timestamp
  expiresAt: Timestamp | null
  resolutionStatus: AntiCheatResolutionStatus | null
  resolvedAt: Timestamp | null
  resolvedBy: string | null
}

export type MonitoredSystem = {
  id: string
  systemKey: string
  name: string
  category: SystemCategory
  environment: RuntimeEnvironment
  status: SystemStatus
  ownerTeam: string | null
  public: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type SystemHeartbeat = {
  id: string
  systemId: string
  source: string
  status: SystemStatus
  metrics: JsonValue
  issues: JsonValue[]
  receivedAt: Timestamp
  sentAt: Timestamp | null
}

export type AuditEvent = {
  id: string
  actorUserId: string | null
  actorExternalId: string | null
  type: string
  targetType: string | null
  targetId: string | null
  data: JsonValue
  previousHash: string | null
  eventHash: string | null
  createdAt: Timestamp
}
