export type AdminWorkspaceId = 'global' | 'lifesteal' | 'general' | 'valorant'

export type AdminUser = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: string
  workspaces: AdminWorkspaceId[]
  permissions: string[]
  expiresAt: number
}

export type AdminApiSubmission = {
  id: string
  workspace: 'lifesteal'
  type: 'Application' | 'Appeal' | 'Player Report' | 'Support'
  status: 'New' | 'In review' | 'Waiting on player' | 'Approved' | 'Denied'
  sourceStatus: string
  title: string
  discord: string
  minecraft: string
  subject: string | null
  createdAt: number
  priority: 'Normal' | 'High'
  claimedBy: string | null
  claimedById: string | null
  summary: string
  fields: Array<{ label: string; value: string }>
  ticketThreadId: string | null
  requiresTicket: boolean
  notes: Array<{ author: string; body: string; time: number }>
  activity: Array<{ type: 'player' | 'staff' | 'system'; author: string; body: string; time: number }>
}

export type AdminOverview = {
  metrics: {
    openWork: number
    openApplications: number
    openSupport: number
    unclaimed: number
    highPriority: number
    linkedPlayers: number
    activeWorkspaces: number
    totalWorkspaces: number
    botConnections: number
    totalBotConnections: number
    authorizedStaff: number
  }
  projects: Array<{
    id: 'lifesteal' | 'general' | 'valorant'
    status: 'operational' | 'frontend_ready' | 'staged'
    openWork: number
    detail: string
  }>
  services: Record<string, { status: 'online' | 'waiting' | 'pending'; detail: string }>
  recentActivity: Array<{
    id: number
    actor: string
    action: string
    target: string
    type: string
    createdAt: number
  }>
  generatedAt: number
}

export type AdminAuditEvent = {
  id: number
  actor: string
  actorId: string | null
  type: 'Review' | 'Submission' | 'Player' | 'Integration' | 'Security' | 'System'
  eventType: string
  action: string
  target: string
  result: 'Success' | 'Warning' | 'Blocked'
  createdAt: number
  data: Record<string, unknown>
}

export type AdminAuditPayload = {
  events: AdminAuditEvent[]
  summary: {
    eventsToday: number
    staffActions: number
    integrationEvents: number
    warnings: number
  }
  updatedAt: number
}

export type StaffChatMessage = {
  id: string
  authorId: string | null
  authorName: string
  authorAvatarUrl: string | null
  content: string
  createdAt: number
}

export type StaffChatPayload = {
  scope: 'lifesteal'
  channelId: string
  channelName: string
  messages: StaffChatMessage[]
  updatedAt: number
}

export type TicketActivityMessage = {
  id: string
  type: 'player' | 'staff' | 'system'
  authorId: string | null
  authorName: string
  authorAvatarUrl: string | null
  content: string
  createdAt: number
}

export type TicketActivityPayload = {
  submissionCode: string
  threadId: string
  threadName: string
  messages: TicketActivityMessage[]
  updatedAt: number
}

export type AdminPlayerStatus = 'Whitelisted' | 'Registered' | 'Applied' | 'Review' | 'Banned' | 'Denied'
export type AdminPlayerBadge = 'Owner' | 'Admin' | 'Mod' | 'SHD Team' | 'Player'

export type AdminPlayerApplication = {
  code: string
  status: string
  discord: string
  minecraft: string
  createdAt: number
  verifiedAt: number | null
  ticketThreadId: string | null
  summary: string
  fields: Array<{ label: string; value: string }>
}

export type AdminPlayer = {
  id: string
  source: 'linked' | 'application'
  discordId: string | null
  discord: string
  minecraftUuid: string | null
  minecraft: string
  badge: AdminPlayerBadge
  badgeValue: string
  status: AdminPlayerStatus
  sourceStatus: string
  hearts: number | null
  risk: string
  updatedAt: number
  applicationCode: string | null
  application: AdminPlayerApplication | null
}

export type AdminPlayersPayload = {
  players: AdminPlayer[]
  updatedAt: number
}

export type CreateAdminPlayerPayload = {
  discordId: string
  discordUsername?: string
  minecraftName: string
  minecraftUuid?: string
  badge: AdminPlayerBadge
  status: Exclude<AdminPlayerStatus, 'Applied'>
}

export type AdminLifestealEvent = {
  id: number
  title: string
  startsAt: number
  endsAt: number | null
  type: string
  reward: string
  objective: string
  summary: string
  priority: number
  status: 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled'
  public: boolean
  announce: boolean
  announcementMessageId: string | null
  createdBy: string
  createdAt: number
  updatedBy: string
  updatedAt: number
}

export type UpsertAdminLifestealEventPayload = {
  title: string
  startsAt: number
  endsAt?: number | null
  type: string
  reward?: string
  objective: string
  summary: string
  priority: number
  status: AdminLifestealEvent['status']
  public: boolean
  announce: boolean
}

type SessionResponse = {
  ok: boolean
  user: AdminUser | null
}

export class AdminApiError extends Error {
  status: number
  code?: string
  claimedBy?: string
  claimedById?: string

  constructor(status: number, payload: { code?: string; error?: string; claimedBy?: string; claimedById?: string }) {
    super(payload.error || `Admin API request failed with HTTP ${status}`)
    this.name = 'AdminApiError'
    this.status = status
    this.code = payload.code
    this.claimedBy = payload.claimedBy
    this.claimedById = payload.claimedById
  }
}

const configuredBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL?.replace(/\/+$/, '') ?? ''
export const adminDemoMode = import.meta.env.VITE_ADMIN_DEMO_MODE === 'true' || !configuredBaseUrl

export const demoAdminUser: AdminUser = {
  id: 'demo-owner',
  username: 'primeluigi',
  displayName: 'PrimeLuigi',
  avatarUrl: null,
  role: 'Owner',
  workspaces: ['global', 'lifesteal', 'general', 'valorant'],
  permissions: ['global:audit', 'integrations:read', 'staff:read', 'staff:manage', 'lifesteal:read', 'lifesteal:review', 'lifesteal:ticket', 'lifesteal:players', 'lifesteal:events', 'lifesteal:staff-chat'],
  expiresAt: Date.now() + 8 * 60 * 60 * 1000,
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${configuredBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new AdminApiError(response.status, payload)
  }
  return response.json() as Promise<T>
}

export async function getAdminSession(): Promise<AdminUser | null> {
  if (adminDemoMode) return null
  try {
    const response = await adminRequest<SessionResponse>('/auth/session')
    return response.user
  } catch (error) {
    if ((error as { status?: number }).status === 401) return null
    throw error
  }
}

export function beginDiscordLogin(returnTo = window.location.pathname) {
  if (adminDemoMode) return
  const loginUrl = new URL(`${configuredBaseUrl}/auth/login`)
  loginUrl.searchParams.set('returnTo', returnTo)
  window.location.assign(loginUrl.toString())
}

export async function endAdminSession() {
  if (adminDemoMode) return
  await adminRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' })
}

export async function getAdminSubmissions(): Promise<AdminApiSubmission[]> {
  if (adminDemoMode) return []
  const response = await adminRequest<{ ok: boolean; submissions: AdminApiSubmission[] }>('/submissions')
  return response.submissions
}

export async function claimAdminSubmission(code: string): Promise<AdminApiSubmission> {
  const response = await adminRequest<{ ok: boolean; submission: AdminApiSubmission }>(
    `/submissions/${encodeURIComponent(code)}/claim`,
    { method: 'POST' },
  )
  return response.submission
}

export async function addAdminSubmissionNote(code: string, text: string): Promise<AdminApiSubmission> {
  const response = await adminRequest<{ ok: boolean; submission: AdminApiSubmission }>(
    `/submissions/${encodeURIComponent(code)}/notes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
  )
  return response.submission
}

export async function decideAdminSubmission(code: string, status: 'waiting_on_player' | 'resolved' | 'approved' | 'denied', reason: string): Promise<AdminApiSubmission> {
  const response = await adminRequest<{ ok: boolean; submission: AdminApiSubmission }>(
    `/submissions/${encodeURIComponent(code)}/decision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason }),
    },
  )
  return response.submission
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await adminRequest<AdminOverview & { ok: boolean }>('/bootstrap')
  return response
}

export async function getAdminAudit(limit = 100): Promise<AdminAuditPayload> {
  if (adminDemoMode) return { events: [], summary: { eventsToday: 0, staffActions: 0, integrationEvents: 0, warnings: 0 }, updatedAt: Date.now() }
  const response = await adminRequest<AdminAuditPayload & { ok: boolean }>(`/audit?limit=${encodeURIComponent(String(limit))}`)
  return response
}

export async function getLifestealStaffChat(): Promise<StaffChatPayload> {
  const response = await adminRequest<StaffChatPayload & { ok: boolean }>('/staff-chat/lifesteal')
  return response
}

export async function sendLifestealStaffChatMessage(content: string): Promise<StaffChatMessage> {
  const response = await adminRequest<{ ok: boolean; message: StaffChatMessage }>(
    '/staff-chat/lifesteal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  )
  return response.message
}

export async function getSubmissionTicketActivity(code: string): Promise<TicketActivityPayload> {
  const response = await adminRequest<TicketActivityPayload & { ok: boolean }>(
    `/submissions/${encodeURIComponent(code)}/ticket-activity`,
  )
  return response
}

export async function sendSubmissionTicketMessage(code: string, content: string): Promise<TicketActivityMessage> {
  const response = await adminRequest<{ ok: boolean; message: TicketActivityMessage }>(
    `/submissions/${encodeURIComponent(code)}/ticket-activity`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  )
  return response.message
}

export async function getAdminPlayers(): Promise<AdminPlayersPayload> {
  if (adminDemoMode) return { players: [], updatedAt: Date.now() }
  const response = await adminRequest<AdminPlayersPayload & { ok: boolean }>('/players')
  return response
}

export async function createAdminPlayer(payload: CreateAdminPlayerPayload): Promise<AdminPlayersPayload> {
  const response = await adminRequest<{ ok: boolean; players: AdminPlayer[]; updatedAt?: number }>(
    '/players',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return { players: response.players, updatedAt: response.updatedAt ?? Date.now() }
}

export async function updateAdminPlayer(id: string, patch: { status?: AdminPlayerStatus; badge?: AdminPlayerBadge }): Promise<AdminPlayersPayload> {
  const response = await adminRequest<{ ok: boolean; players: AdminPlayer[]; updatedAt?: number }>(
    `/players/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  )
  return { players: response.players, updatedAt: response.updatedAt ?? Date.now() }
}

export async function deleteAdminPlayer(id: string): Promise<AdminPlayersPayload> {
  const response = await adminRequest<{ ok: boolean; players: AdminPlayer[]; updatedAt?: number }>(
    `/players/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  return { players: response.players, updatedAt: response.updatedAt ?? Date.now() }
}

export async function getAdminLifestealEvents(): Promise<{ events: AdminLifestealEvent[]; updatedAt: number }> {
  if (adminDemoMode) return { events: [], updatedAt: Date.now() }
  const response = await adminRequest<{ ok: boolean; events: AdminLifestealEvent[]; updatedAt?: number }>('/lifesteal/events')
  return { events: response.events, updatedAt: response.updatedAt ?? Date.now() }
}

export async function createAdminLifestealEvent(payload: UpsertAdminLifestealEventPayload): Promise<{ events: AdminLifestealEvent[]; event: AdminLifestealEvent }> {
  const response = await adminRequest<{ ok: boolean; event: AdminLifestealEvent; events: AdminLifestealEvent[] }>('/lifesteal/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { event: response.event, events: response.events }
}

export async function updateAdminLifestealEvent(id: number, payload: UpsertAdminLifestealEventPayload): Promise<{ events: AdminLifestealEvent[]; event: AdminLifestealEvent }> {
  const response = await adminRequest<{ ok: boolean; event: AdminLifestealEvent; events: AdminLifestealEvent[] }>(`/lifesteal/events/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { event: response.event, events: response.events }
}

export async function deleteAdminLifestealEvent(id: number): Promise<{ events: AdminLifestealEvent[] }> {
  const response = await adminRequest<{ ok: boolean; events: AdminLifestealEvent[] }>(`/lifesteal/events/${encodeURIComponent(String(id))}`, { method: 'DELETE' })
  return { events: response.events }
}
