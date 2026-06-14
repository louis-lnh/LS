export type AdminWorkspaceId = 'global' | 'lifesteal' | 'general' | 'valorant'

export type AdminUser = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: string
  workspaces: AdminWorkspaceId[]
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

export async function decideAdminSubmission(code: string, status: 'waiting_on_player' | 'resolved' | 'denied', reason: string): Promise<AdminApiSubmission> {
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
