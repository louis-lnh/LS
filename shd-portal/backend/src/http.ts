import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiErrorCode, ApiResponse } from './api-contract.js'

export type HttpContext = {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  params: Record<string, string>
}

export type Handler = (context: HttpContext) => Promise<unknown>

export type RuntimeRoute = {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
}

export function json<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T, Record<string, unknown>> {
  return { ok: true, data, meta }
}

export function apiError(code: ApiErrorCode, message: string, details?: unknown): ApiResponse<never> {
  return { ok: false, error: { code, message, details } }
}

export function statusForError(code: ApiErrorCode) {
  if (code === 'bad_request') return 400
  if (code === 'unauthorized') return 401
  if (code === 'forbidden') return 403
  if (code === 'not_found') return 404
  if (code === 'conflict') return 409
  return 500
}

export function defineRoute(method: string, path: string, handler: Handler): RuntimeRoute {
  const keys: string[] = []
  const pattern = new RegExp(`^${path.replace(/:[^/]+/g, (match) => {
    keys.push(match.slice(1))
    return '([^/]+)'
  })}$`)
  return { method, pattern, keys, handler }
}

export function matchRoute(routes: RuntimeRoute[], method: string, pathname: string) {
  for (const route of routes) {
    if (route.method !== method) continue
    const match = pathname.match(route.pattern)
    if (!match) continue
    const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1] || '')]))
    return { route, params }
  }
  return null
}

export async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
