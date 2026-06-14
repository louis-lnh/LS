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
  activity: Array<{ type: 'player' | 'staff' | 'system'; author: string; body: string; time: number }>
}

type SessionResponse = {
  ok: boolean
  user: AdminUser | null
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
    const error = new Error(`Admin API request failed with HTTP ${response.status}`)
    Object.assign(error, { status: response.status })
    throw error
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
