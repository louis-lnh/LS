import { createServer } from 'node:http'
import { z } from 'zod'
import { loadConfig } from './config.js'
import { createDatabase } from './db.js'
import { apiError, defineRoute, json, matchRoute, readJson, statusForError } from './http.js'
import { createPostgresRepositories } from './postgres-repositories.js'
import type { ApiFailure } from './api-contract.js'
import { authorizeBridgeRequest } from './service-auth.js'
import type { BridgeSystemHeartbeatInput } from './bridge-contract.js'

const config = loadConfig()
const db = createDatabase(config)
const repositories = createPostgresRepositories(db)

function requireAdmin(headers: Record<string, string | string[] | undefined>) {
  if (!config.adminApiToken) return config.nodeEnv !== 'production'
  const authorization = headers.authorization
  return authorization === `Bearer ${config.adminApiToken}`
}

const routes = [
  defineRoute('GET', '/api/v1/health', async () => json({ status: 'ok' })),
  defineRoute('GET', '/api/v1/admin/events', async ({ req }) => {
    if (!requireAdmin(req.headers)) return apiError('unauthorized', 'Admin authentication required.')
    return json(await repositories.listAdminEvents())
  }),
  defineRoute('GET', '/api/v1/admin/events/:eventCodeOrId', async ({ req, params }) => {
    if (!requireAdmin(req.headers)) return apiError('unauthorized', 'Admin authentication required.')
    const event = await repositories.getAdminEvent(params.eventCodeOrId)
    if (!event) return apiError('not_found', 'Event not found.')
    return json(event)
  }),
  defineRoute('GET', '/api/v1/public/events', async () => json({ events: await repositories.listPublicEvents() })),
  defineRoute('GET', '/api/v1/admin/systems', async ({ req }) => {
    if (!requireAdmin(req.headers)) return apiError('unauthorized', 'Admin authentication required.')
    return json(await repositories.listAdminSystems())
  }),
  defineRoute('GET', '/api/v1/bridge/events/feed/:targetKey', async ({ req, params }) => {
    const auth = authorizeBridgeRequest(req.headers, 'events:read')
    if (!auth.ok) return apiError('unauthorized', auth.reason)
    return json(await repositories.listEventFeedForTarget(params.targetKey))
  }),
  defineRoute('POST', '/api/v1/bridge/systems/heartbeat', async ({ req }) => {
    const auth = authorizeBridgeRequest(req.headers, 'systems:write')
    if (!auth.ok) return apiError('unauthorized', auth.reason)
    const body = bridgeSystemHeartbeatSchema.parse(await readJson(req)) as BridgeSystemHeartbeatInput
    const result = await repositories.recordSystemHeartbeat(body)
    return json({
      systemKey: result.system.systemKey,
      previousStatus: result.previousStatus,
      status: result.system.status,
      statusChanged: result.previousStatus !== result.system.status,
      receivedAt: result.heartbeat.receivedAt,
    })
  }),
]

const bridgeSystemHeartbeatSchema = z.object({
  systemKey: z.string().min(1).max(120),
  name: z.string().min(1).max(160).optional(),
  category: z.enum(['vps', 'discord_bot', 'backend', 'website', 'minecraft_server', 'agent']).optional(),
  status: z.enum(['healthy', 'warning', 'critical', 'paused', 'unknown']),
  source: z.string().min(1).max(120),
  sentAt: z.string().max(120).optional().nullable(),
  metrics: z.unknown().optional(),
  issues: z.array(z.unknown()).optional(),
})

function isApiFailure(payload: unknown): payload is ApiFailure {
  return Boolean(payload && typeof payload === 'object' && 'ok' in payload && payload.ok === false)
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-SHD-Service, X-SHD-Request-ID, X-SHD-Actor')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const match = matchRoute(routes, req.method || 'GET', url.pathname)
    if (!match) {
      const payload = apiError('not_found', 'Route not found.')
      res.writeHead(404)
      res.end(JSON.stringify(payload))
      return
    }
    const payload = await match.route.handler({ req, res, url, params: match.params })
    if (isApiFailure(payload)) {
      res.writeHead(statusForError(payload.error.code))
    } else {
      res.writeHead(200)
    }
    res.end(JSON.stringify(payload))
  } catch (error) {
    const payload = apiError('internal_error', 'Internal server error.', config.nodeEnv === 'production' ? undefined : String(error))
    res.writeHead(500)
    res.end(JSON.stringify(payload))
  }
})

server.listen(config.port, () => {
  console.log(`SHD portal backend listening on ${config.port}`)
})

process.on('SIGTERM', () => {
  server.close(() => {
    void db.close().then(() => process.exit(0))
  })
})
