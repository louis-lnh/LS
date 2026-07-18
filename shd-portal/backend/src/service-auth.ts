import type { BridgeRequestContext, BridgeServiceKey } from './bridge-contract.js'

export type ServiceCredential = {
  service: BridgeServiceKey
  tokenEnvName: string
  scopes: ServiceScope[]
}

export type ServiceScope =
  | 'identity:read'
  | 'anticheat:write'
  | 'anticheat:resolve'
  | 'support:write'
  | 'chat:write'
  | 'events:read'
  | 'events:publish'
  | 'systems:write'
  | 'systems:actions'

export const serviceCredentials: ServiceCredential[] = [
  {
    service: 'lifesteal-discord-bot',
    tokenEnvName: 'LIFESTEAL_DISCORD_BOT_SERVICE_TOKEN',
    scopes: ['identity:read', 'anticheat:resolve', 'support:write', 'chat:write', 'events:read'],
  },
  {
    service: 'main-discord-bot',
    tokenEnvName: 'MAIN_DISCORD_BOT_SERVICE_TOKEN',
    scopes: ['identity:read', 'support:write', 'chat:write', 'events:read'],
  },
  {
    service: 'lifesteal-minecraft-server',
    tokenEnvName: 'LIFESTEAL_MINECRAFT_SERVICE_TOKEN',
    scopes: ['identity:read', 'anticheat:write', 'events:read'],
  },
  {
    service: 'shd-agent-lifesteal-g17',
    tokenEnvName: 'SHD_AGENT_LIFESTEAL_G17_SERVICE_TOKEN',
    scopes: ['systems:write', 'systems:actions'],
  },
  {
    service: 'lifesteal-website',
    tokenEnvName: 'LIFESTEAL_WEBSITE_SERVICE_TOKEN',
    scopes: ['events:read'],
  },
  {
    service: 'shd-portal',
    tokenEnvName: 'SHD_PORTAL_SERVICE_TOKEN',
    scopes: ['identity:read', 'events:read', 'support:write', 'chat:write'],
  },
]

export function hasServiceScope(service: BridgeServiceKey, scope: ServiceScope) {
  return serviceCredentials.some((credential) => credential.service === service && credential.scopes.includes(scope))
}

export function readBridgeRequestContext(headers: Record<string, string | undefined>): BridgeRequestContext | null {
  const service = headers['x-shd-service'] as BridgeServiceKey | undefined
  const requestId = headers['x-shd-request-id']
  if (!service || !requestId) return null
  if (!serviceCredentials.some((credential) => credential.service === service)) return null
  return {
    service,
    requestId,
    actor: headers['x-shd-actor'],
  }
}

export function authorizeBridgeRequest(
  headers: Record<string, string | string[] | undefined>,
  scope: ServiceScope,
): { ok: true; context: BridgeRequestContext } | { ok: false; reason: string } {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value]),
  )
  const context = readBridgeRequestContext(normalizedHeaders)
  if (!context) return { ok: false, reason: 'Missing or invalid bridge service headers.' }
  if (!hasServiceScope(context.service, scope)) return { ok: false, reason: 'Bridge service does not have the required scope.' }

  const credential = serviceCredentials.find((item) => item.service === context.service)
  const expectedToken = credential ? process.env[credential.tokenEnvName]?.trim() : null
  const authorization = normalizedHeaders.authorization
  const actualToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null
  if (!expectedToken) return { ok: false, reason: `Service token env ${credential?.tokenEnvName ?? 'unknown'} is not configured.` }
  if (!actualToken || actualToken !== expectedToken) return { ok: false, reason: 'Invalid bridge service token.' }

  return { ok: true, context }
}
