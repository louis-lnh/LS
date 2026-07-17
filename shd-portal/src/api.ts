export type WorkspaceId = 'global' | 'lifesteal' | 'general' | 'valorant'

export type PortalUser = {
  id: string
  shdId?: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: string
  workspaces: WorkspaceId[]
  permissions: string[]
  expiresAt: number
  linkedDiscord?: {
    id: string
    username: string
  } | null
  linkedMinecraft?: {
    uuid: string
    username: string
  } | null
}

export type SessionResult =
  | { authenticated: true; user: PortalUser }
  | { authenticated: false; user: null }

export class PortalApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'PortalApiError'
    this.status = status
    this.code = code
  }
}

const apiBaseUrl = (import.meta.env.VITE_PORTAL_API_BASE_URL || 'https://verify.shd-esports.com/api/v1/admin').replace(/\/+$/, '')
const demoMode = import.meta.env.VITE_PORTAL_DEMO_MODE === 'true'

export const portalDemoMode = demoMode

export const demoPortalUser: PortalUser = {
  id: '1248919319967039498',
  shdId: 'SHD0001',
  username: 'PrimeLuigi',
  displayName: 'PrimeLuigi',
  avatarUrl: null,
  role: 'Owner',
  workspaces: ['global', 'lifesteal', 'general', 'valorant'],
  permissions: [
    'global:read',
    'global:admin',
    'lifesteal:read',
    'lifesteal:review',
    'lifesteal:ticket',
    'lifesteal:staff-chat',
    'lifesteal:players',
    'lifesteal:events',
  ],
  expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  linkedDiscord: {
    id: '1248919319967039498',
    username: 'vlt_luigi',
  },
  linkedMinecraft: {
    uuid: '6ad0d6d1-90ca-49aa-b5aa-d4c7e197b60e',
    username: 'PrimeLuigi',
  },
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    let payload: { error?: string; code?: string } = {}
    try {
      payload = await response.json()
    } catch {
      payload = {}
    }
    throw new PortalApiError(payload.error || `Portal API failed with HTTP ${response.status}`, response.status, payload.code)
  }

  return response.json() as Promise<T>
}

export async function getPortalSession(): Promise<SessionResult> {
  if (demoMode) return { authenticated: true, user: demoPortalUser }
  try {
    const payload = await request<{ authenticated: boolean; user?: PortalUser | null }>('/auth/session')
    return payload.authenticated && payload.user
      ? { authenticated: true, user: payload.user }
      : { authenticated: false, user: null }
  } catch (error) {
    if (error instanceof PortalApiError && error.status === 401) {
      return { authenticated: false, user: null }
    }
    throw error
  }
}

export function beginPortalLogin(returnTo = window.location.pathname + window.location.search) {
  if (demoMode) {
    window.history.pushState({}, '', returnTo || '/dashboard')
    window.dispatchEvent(new Event('portal-demo-login'))
    return
  }
  const target = new URL(`${apiBaseUrl}/auth/login`)
  target.searchParams.set('returnTo', returnTo || '/dashboard')
  window.location.assign(target.toString())
}

export async function endPortalSession() {
  if (demoMode) return
  await request('/auth/logout', { method: 'POST' })
}

export function hasPermission(user: PortalUser | null, permission: string) {
  if (!user) return false
  return user.permissions.includes(permission) || user.permissions.includes('global:admin')
}

export function hasWorkspace(user: PortalUser | null, workspace: WorkspaceId) {
  if (!user) return false
  return user.workspaces.includes(workspace) || user.workspaces.includes('global')
}
