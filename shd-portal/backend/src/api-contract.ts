import type {
  AntiCheatRecord,
  AuditEvent,
  EventPublishTarget,
  EventRecord,
  EventScheduleEntry,
  LinkedDiscordAccount,
  LinkedMinecraftAccount,
  MonitoredSystem,
  SupportSubmission,
  SystemActionStatus,
  SystemHeartbeat,
  SystemStatus,
  User,
  UserRole,
} from './domain.js'

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'internal_error'

export type ApiSuccess<TData, TMeta = Record<string, never>> = {
  ok: true
  data: TData
  meta?: TMeta
}

export type ApiFailure = {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
}

export type ApiResponse<TData, TMeta = Record<string, never>> = ApiSuccess<TData, TMeta> | ApiFailure

export type AdminEventSummary = EventRecord & {
  publishTargets: EventPublishTarget[]
  scheduleCount: number
}

export type AdminEventsListResponse = {
  metrics: {
    published: number
    drafts: number
    archived: number
    feeds: number
  }
  events: AdminEventSummary[]
}

export type AdminEventDetailResponse = {
  event: EventRecord
  scheduleEntries: EventScheduleEntry[]
  publishTargets: EventPublishTarget[]
  auditPreview: AuditEvent[]
}

export type PublicEventSummary = Pick<
  EventRecord,
  'eventCode' | 'workspace' | 'title' | 'slug' | 'category' | 'startsAt' | 'endsAt' | 'timezone' | 'summary' | 'description' | 'publicUrl'
> & {
  scheduleEntries: EventScheduleEntry[]
}

export type SystemOverviewRow = MonitoredSystem & {
  latestHeartbeat: SystemHeartbeat | null
}

export type AdminSystemsListResponse = {
  metrics: {
    healthy: number
    warning: number
    critical: number
    monitored: number
  }
  groups: Array<{
    category: MonitoredSystem['category']
    title: string
    systems: SystemOverviewRow[]
  }>
}

export type AdminSystemDetailResponse = {
  system: MonitoredSystem
  latestHeartbeat: SystemHeartbeat | null
  history: SystemHeartbeat[]
  recentActions: Array<{
    id: string
    actionType: string
    status: SystemActionStatus
    createdAt: string
    finishedAt: string | null
  }>
  linkedServices: Array<{
    key: string
    label: string
    status: SystemStatus
  }>
}

export type AdminSupportListResponse = {
  metrics: {
    total: number
    minecraft: number
    events: number
    valorant: number
  }
  open: SupportSubmission[]
  archived: SupportSubmission[]
}

export type AdminUserSummary = User & {
  roles: UserRole[]
  primaryDiscord: LinkedDiscordAccount | null
  primaryMinecraft: LinkedMinecraftAccount | null
  riskAlerts: number
}

export type AdminUsersListResponse = {
  owners: AdminUserSummary[]
  staff: AdminUserSummary[]
  members: AdminUserSummary[]
}

export type AdminUserDetailResponse = {
  user: User
  roles: UserRole[]
  discordAccounts: LinkedDiscordAccount[]
  minecraftAccounts: LinkedMinecraftAccount[]
  openSubmissions: SupportSubmission[]
  archivedSubmissions: SupportSubmission[]
  antiCheatRecords: AntiCheatRecord[]
  recentAuditEvents: AuditEvent[]
}

export type MinecraftIdentityLookupResponse = {
  user: Pick<User, 'id' | 'shdId' | 'displayName' | 'publicProfile' | 'status'> | null
  minecraftAccount: LinkedMinecraftAccount | null
  discordAccount: LinkedDiscordAccount | null
  roles: UserRole[]
}
