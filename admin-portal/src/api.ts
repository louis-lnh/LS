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

export type AdminStaffMember = {
  id: string
  accessRecordId: number | null
  name: string
  discord: string
  discordId: string
  avatarUrl: string | null
  role: string
  workspaces: AdminWorkspaceId[]
  permissions: string[]
  status: 'Active' | 'Limited' | 'Invite pending' | 'Review'
  trust: 'Full' | 'Scoped' | 'Pending'
  source: string
  firstSeen: number
  lastActive: number
  portalActions: number
  notes: string
  activity: Array<{
    id: number
    action: string
    target: string
    eventType: string
    createdAt: number
    data: Record<string, unknown>
  }>
}

export type AdminStaffAccessPayload = {
  staff: AdminStaffMember[]
  updatedAt: number
}

export type AdminStaffAccessMutation = {
  discordId?: string | null
  displayName: string
  role: string
  workspaces: AdminWorkspaceId[]
  status: AdminStaffMember['status']
  trust: AdminStaffMember['trust']
  notes?: string
}

export type AdminApiSubmission = {
  id: string
  workspace: AdminWorkspaceId
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
const configuredShdBaseUrl = import.meta.env.VITE_SHD_ADMIN_API_BASE_URL?.replace(/\/+$/, '') ?? ''
type AdminBackend = 'lifesteal' | 'shd'
const requestedAuthBackend = import.meta.env.VITE_ADMIN_AUTH_BACKEND
const configuredAuthBackend = (
  requestedAuthBackend === 'shd' || requestedAuthBackend === 'lifesteal'
    ? requestedAuthBackend
    : configuredShdBaseUrl ? 'shd' : 'lifesteal'
) as AdminBackend
const authBaseUrl = configuredAuthBackend === 'shd' ? configuredShdBaseUrl : configuredBaseUrl
export const adminDemoMode = import.meta.env.VITE_ADMIN_DEMO_MODE === 'true' || !authBaseUrl
const submissionBackends = new Map<string, 'lifesteal' | 'shd'>()

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

async function shdAdminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!configuredShdBaseUrl) throw new AdminApiError(503, { code: 'SHD_ADMIN_API_NOT_CONFIGURED', error: 'SHD admin API is not configured.' })
  const response = await fetch(`${configuredShdBaseUrl}${path}`, {
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

async function optionalRequest<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request()
  } catch {
    return null
  }
}

export async function getAdminSession(): Promise<AdminUser | null> {
  if (adminDemoMode) return null
  try {
    const request = configuredAuthBackend === 'shd' ? shdAdminRequest : adminRequest
    const response = await request<SessionResponse>('/auth/session')
    return response.user
  } catch (error) {
    if ((error as { status?: number }).status === 401) return null
    throw error
  }
}

export function beginDiscordLogin(returnTo = window.location.pathname) {
  if (adminDemoMode) return
  const loginUrl = new URL(`${authBaseUrl}/auth/login`)
  loginUrl.searchParams.set('returnTo', returnTo)
  window.location.assign(loginUrl.toString())
}

export function beginShdDiscordLogin(returnTo = window.location.pathname) {
  if (!configuredShdBaseUrl) return
  const loginUrl = new URL(`${configuredShdBaseUrl}/auth/login`)
  loginUrl.searchParams.set('returnTo', returnTo)
  window.location.assign(loginUrl.toString())
}

export async function endAdminSession() {
  if (adminDemoMode) return
  const request = configuredAuthBackend === 'shd' ? shdAdminRequest : adminRequest
  await request<{ ok: boolean }>('/auth/logout', { method: 'POST' })
}

export async function getAdminSubmissions(): Promise<AdminApiSubmission[]> {
  if (adminDemoMode) return []
  const [lifesteal, shd] = await Promise.all([
    optionalRequest(() => adminRequest<{ ok: boolean; submissions: AdminApiSubmission[] }>('/submissions')),
    optionalRequest(() => shdAdminRequest<{ ok: boolean; submissions: AdminApiSubmission[] }>('/submissions')),
  ])
  const lifestealSubmissions = (lifesteal?.submissions ?? []).map((submission) => ({ ...submission, workspace: 'lifesteal' as const }))
  const shdSubmissions = shd?.submissions ?? []
  submissionBackends.clear()
  for (const submission of lifestealSubmissions) submissionBackends.set(submission.id, 'lifesteal')
  for (const submission of shdSubmissions) submissionBackends.set(submission.id, 'shd')
  return [...lifestealSubmissions, ...shdSubmissions].sort((a, b) => b.createdAt - a.createdAt)
}

export async function claimAdminSubmission(code: string): Promise<AdminApiSubmission> {
  const request = backendForSubmission(code) === 'shd' ? shdAdminRequest : adminRequest
  const response = await request<{ ok: boolean; submission: AdminApiSubmission }>(
    `/submissions/${encodeURIComponent(code)}/claim`,
    { method: 'POST' },
  )
  return response.submission
}

export async function addAdminSubmissionNote(code: string, text: string): Promise<AdminApiSubmission> {
  const request = backendForSubmission(code) === 'shd' ? shdAdminRequest : adminRequest
  const response = await request<{ ok: boolean; submission: AdminApiSubmission }>(
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
  const request = backendForSubmission(code) === 'shd' ? shdAdminRequest : adminRequest
  const response = await request<{ ok: boolean; submission: AdminApiSubmission }>(
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
  const [lifesteal, shd] = await Promise.all([
    optionalRequest(() => adminRequest<AdminOverview & { ok: boolean }>('/bootstrap')),
    optionalRequest(() => shdAdminRequest<AdminOverview & { ok: boolean }>('/bootstrap')),
  ])
  if (!lifesteal && !shd) throw new AdminApiError(503, { error: 'No admin backend could be reached.' })
  if (!lifesteal) return shd as AdminOverview
  if (!shd) return lifesteal
  return mergeOverview(lifesteal, shd)
}

export async function getAdminAudit(limit = 100): Promise<AdminAuditPayload> {
  if (adminDemoMode) return { events: [], summary: { eventsToday: 0, staffActions: 0, integrationEvents: 0, warnings: 0 }, updatedAt: Date.now() }
  const [lifesteal, shd] = await Promise.all([
    optionalRequest(() => adminRequest<AdminAuditPayload & { ok: boolean }>(`/audit?limit=${encodeURIComponent(String(limit))}`)),
    optionalRequest(() => shdAdminRequest<AdminAuditPayload & { ok: boolean }>(`/audit?limit=${encodeURIComponent(String(limit))}`)),
  ])
  const events = [...(lifesteal?.events ?? []), ...(shd?.events ?? [])]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
  return {
    events,
    summary: {
      eventsToday: (lifesteal?.summary.eventsToday ?? 0) + (shd?.summary.eventsToday ?? 0),
      staffActions: (lifesteal?.summary.staffActions ?? 0) + (shd?.summary.staffActions ?? 0),
      integrationEvents: (lifesteal?.summary.integrationEvents ?? 0) + (shd?.summary.integrationEvents ?? 0),
      warnings: (lifesteal?.summary.warnings ?? 0) + (shd?.summary.warnings ?? 0),
    },
    updatedAt: Math.max(lifesteal?.updatedAt ?? 0, shd?.updatedAt ?? 0, Date.now()),
  }
}

export async function getAdminStaffAccess(): Promise<AdminStaffAccessPayload> {
  if (adminDemoMode) return { staff: [], updatedAt: Date.now() }
  const [lifesteal, shd] = await Promise.all([
    optionalRequest(() => adminRequest<AdminStaffAccessPayload & { ok: boolean }>('/staff')),
    optionalRequest(() => shdAdminRequest<AdminStaffAccessPayload & { ok: boolean }>('/staff')),
  ])
  const staffById = new Map<string, AdminStaffMember>()
  for (const member of [...(lifesteal?.staff ?? []), ...(shd?.staff ?? [])]) {
    staffById.set(member.id, staffById.has(member.id)
      ? {
          ...staffById.get(member.id)!,
          workspaces: Array.from(new Set([...staffById.get(member.id)!.workspaces, ...member.workspaces])),
          permissions: Array.from(new Set([...staffById.get(member.id)!.permissions, ...member.permissions])),
          activity: [...staffById.get(member.id)!.activity, ...member.activity],
        }
      : member)
  }
  return {
    staff: Array.from(staffById.values()),
    updatedAt: Math.max(lifesteal?.updatedAt ?? 0, shd?.updatedAt ?? 0, Date.now()),
  }
}

function backendForSubmission(code: string): 'lifesteal' | 'shd' {
  return submissionBackends.get(code) ?? 'lifesteal'
}

function mergeOverview(lifesteal: AdminOverview, shd: AdminOverview): AdminOverview {
  const projectMap = new Map<AdminOverview['projects'][number]['id'], AdminOverview['projects'][number]>()
  for (const project of lifesteal.projects) projectMap.set(project.id, project)
  for (const project of shd.projects) projectMap.set(project.id, project)
  return {
    metrics: {
      openWork: lifesteal.metrics.openWork + shd.metrics.openWork,
      openApplications: lifesteal.metrics.openApplications + shd.metrics.openApplications,
      openSupport: lifesteal.metrics.openSupport + shd.metrics.openSupport,
      unclaimed: lifesteal.metrics.unclaimed + shd.metrics.unclaimed,
      highPriority: lifesteal.metrics.highPriority + shd.metrics.highPriority,
      linkedPlayers: lifesteal.metrics.linkedPlayers,
      activeWorkspaces: Math.max(lifesteal.metrics.activeWorkspaces, shd.metrics.activeWorkspaces),
      totalWorkspaces: Math.max(lifesteal.metrics.totalWorkspaces, shd.metrics.totalWorkspaces),
      botConnections: lifesteal.metrics.botConnections + shd.metrics.botConnections,
      totalBotConnections: lifesteal.metrics.totalBotConnections + shd.metrics.totalBotConnections,
      authorizedStaff: Math.max(lifesteal.metrics.authorizedStaff, shd.metrics.authorizedStaff),
    },
    projects: Array.from(projectMap.values()),
    services: { ...lifesteal.services, ...shd.services },
    recentActivity: [...lifesteal.recentActivity, ...shd.recentActivity]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12),
    generatedAt: Math.max(lifesteal.generatedAt, shd.generatedAt),
  }
}

export async function createAdminStaffAccess(payload: AdminStaffAccessMutation): Promise<AdminStaffAccessPayload> {
  const response = await adminRequest<AdminStaffAccessPayload & { ok: boolean }>(
    '/staff',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return response
}

export async function updateAdminStaffAccess(id: string, payload: AdminStaffAccessMutation): Promise<AdminStaffAccessPayload> {
  const response = await adminRequest<AdminStaffAccessPayload & { ok: boolean }>(
    `/staff/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return response
}

export async function deleteAdminStaffAccess(id: string): Promise<AdminStaffAccessPayload> {
  const response = await adminRequest<AdminStaffAccessPayload & { ok: boolean }>(
    `/staff/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
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

export async function resendAdminLifestealEventAnnouncement(id: number): Promise<{ events: AdminLifestealEvent[]; event: AdminLifestealEvent }> {
  const response = await adminRequest<{ ok: boolean; event: AdminLifestealEvent; events: AdminLifestealEvent[] }>(
    `/lifesteal/events/${encodeURIComponent(String(id))}/announcement`,
    { method: 'POST' },
  )
  return { event: response.event, events: response.events }
}

export async function deleteAdminLifestealEvent(id: number): Promise<{ events: AdminLifestealEvent[] }> {
  const response = await adminRequest<{ ok: boolean; events: AdminLifestealEvent[] }>(`/lifesteal/events/${encodeURIComponent(String(id))}`, { method: 'DELETE' })
  return { events: response.events }
}
