import type {
  EventPublishTarget,
  EventRecord,
  EventScheduleEntry,
  MonitoredSystem,
  SystemHeartbeat,
} from './domain.js'

type AnyRow = Record<string, unknown>

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  return value ? String(value) : null
}

export function mapEvent(row: AnyRow): EventRecord {
  return {
    id: String(row.id),
    eventCode: String(row.event_code),
    parentEventId: row.parent_event_id ? String(row.parent_event_id) : null,
    workspace: String(row.workspace),
    title: String(row.title),
    slug: String(row.slug),
    category: String(row.category),
    status: row.status as EventRecord['status'],
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    timezone: String(row.timezone),
    summary: String(row.summary ?? ''),
    description: String(row.description ?? ''),
    publicUrl: row.public_url ? String(row.public_url) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    publishedAt: iso(row.published_at),
    archivedAt: iso(row.archived_at),
    createdAt: iso(row.created_at) || '',
    updatedAt: iso(row.updated_at) || '',
  }
}

export function mapScheduleEntry(row: AnyRow): EventScheduleEntry {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    title: String(row.title),
    type: String(row.type),
    startsAt: iso(row.starts_at) || '',
    endsAt: iso(row.ends_at),
    reward: row.reward ? String(row.reward) : null,
    objective: row.objective ? String(row.objective) : null,
    summary: row.summary ? String(row.summary) : null,
    priority: Number(row.priority ?? 10),
    public: Boolean(row.public),
    createdAt: iso(row.created_at) || '',
    updatedAt: iso(row.updated_at) || '',
  }
}

export function mapPublishTarget(row: AnyRow): EventPublishTarget {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    targetType: row.target_type as EventPublishTarget['targetType'],
    targetKey: String(row.target_key),
    enabled: Boolean(row.enabled),
    lastSyncedAt: iso(row.last_synced_at),
    lastError: row.last_error ? String(row.last_error) : null,
  }
}

export function mapSystem(row: AnyRow): MonitoredSystem {
  return {
    id: String(row.id),
    systemKey: String(row.system_key),
    name: String(row.name),
    category: row.category as MonitoredSystem['category'],
    environment: row.environment as MonitoredSystem['environment'],
    status: row.status as MonitoredSystem['status'],
    ownerTeam: row.owner_team ? String(row.owner_team) : null,
    public: Boolean(row.public),
    createdAt: iso(row.created_at) || '',
    updatedAt: iso(row.updated_at) || '',
  }
}

export function mapHeartbeat(row: AnyRow): SystemHeartbeat {
  return {
    id: String(row.id),
    systemId: String(row.system_id),
    source: String(row.source),
    status: row.status as SystemHeartbeat['status'],
    metrics: row.metrics as SystemHeartbeat['metrics'],
    issues: row.issues as SystemHeartbeat['issues'],
    receivedAt: iso(row.received_at) || '',
    sentAt: iso(row.sent_at),
  }
}
