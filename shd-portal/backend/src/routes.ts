import type { ServiceScope } from './service-auth.js'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type RouteDefinition = {
  method: HttpMethod
  path: string
  audience: 'admin' | 'public' | 'bridge'
  description: string
  requiredScope?: ServiceScope
}

export const readRoutes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/api/v1/admin/events',
    audience: 'admin',
    description: 'List admin event records with metrics and publish targets.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/events/:eventCodeOrId',
    audience: 'admin',
    description: 'Read one admin event with schedule entries, publish targets, and audit preview.',
  },
  {
    method: 'GET',
    path: '/api/v1/public/events',
    audience: 'public',
    description: 'List published public events.',
  },
  {
    method: 'GET',
    path: '/api/v1/public/events/:slug',
    audience: 'public',
    description: 'Read one published public event by slug.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/systems',
    audience: 'admin',
    description: 'List monitored systems grouped by category.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/systems/:systemKey',
    audience: 'admin',
    description: 'Read one monitored system with heartbeat history.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/support',
    audience: 'admin',
    description: 'List support review queues and archived submissions.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/support/:submissionCodeOrId',
    audience: 'admin',
    description: 'Read one support submission with identity, fields, chat preview, and review state.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/users',
    audience: 'admin',
    description: 'List users grouped by owners, staff, and members.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/users/:shdIdOrUserId',
    audience: 'admin',
    description: 'Read one staff-visible user profile.',
  },
]

export const bridgeRoutes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/api/v1/bridge/identity/minecraft/:minecraftUuid',
    audience: 'bridge',
    requiredScope: 'identity:read',
    description: 'Resolve SHD identity by Minecraft UUID.',
  },
  {
    method: 'GET',
    path: '/api/v1/bridge/identity/shd/:shdId',
    audience: 'bridge',
    requiredScope: 'identity:read',
    description: 'Resolve SHD identity by SHD ID.',
  },
  {
    method: 'POST',
    path: '/api/v1/bridge/anticheat/records',
    audience: 'bridge',
    requiredScope: 'anticheat:write',
    description: 'Record or update an anti-cheat evidence record.',
  },
  {
    method: 'POST',
    path: '/api/v1/bridge/anticheat/records/:appealId/resolve',
    audience: 'bridge',
    requiredScope: 'anticheat:resolve',
    description: 'Resolve an anti-cheat appeal/evidence record.',
  },
  {
    method: 'POST',
    path: '/api/v1/bridge/support/submissions',
    audience: 'bridge',
    requiredScope: 'support:write',
    description: 'Create a canonical support submission from portal or Discord.',
  },
  {
    method: 'POST',
    path: '/api/v1/bridge/support/submissions/:submissionCode/status',
    audience: 'bridge',
    requiredScope: 'support:write',
    description: 'Update submission review/status from Discord or portal.',
  },
  {
    method: 'POST',
    path: '/api/v1/bridge/chats/:chatCode/messages',
    audience: 'bridge',
    requiredScope: 'chat:write',
    description: 'Append a message to a portal/Discord bridged chat.',
  },
  {
    method: 'POST',
    path: '/api/v1/bridge/events/:eventCode/publish',
    audience: 'bridge',
    requiredScope: 'events:publish',
    description: 'Publish an event and queue downstream sync targets.',
  },
  {
    method: 'GET',
    path: '/api/v1/bridge/events/feed/:targetKey',
    audience: 'bridge',
    requiredScope: 'events:read',
    description: 'Read published event feed for a specific website/bot/server target.',
  },
  {
    method: 'POST',
    path: '/api/v1/bridge/systems/heartbeat',
    audience: 'bridge',
    requiredScope: 'systems:write',
    description: 'Record a system heartbeat from SHD Agent or service monitors.',
  },
  {
    method: 'GET',
    path: '/api/v1/bridge/systems/actions/pending',
    audience: 'bridge',
    requiredScope: 'systems:actions',
    description: 'Read pending system actions for an agent when actions are enabled.',
  },
]

export const routeDefinitions = [...readRoutes, ...bridgeRoutes]
