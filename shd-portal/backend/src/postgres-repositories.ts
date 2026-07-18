import type { Database } from './db.js'
import type { AdminEventsListResponse, AdminSystemsListResponse } from './api-contract.js'
import { mapEvent, mapHeartbeat, mapPublishTarget, mapScheduleEntry, mapSystem } from './row-mappers.js'
import type { BridgeSystemHeartbeatInput } from './bridge-contract.js'

export function createPostgresRepositories(db: Database) {
  return {
    async listAdminEvents(): Promise<AdminEventsListResponse> {
      const events = await db.query<Record<string, unknown> & { schedule_count: string }>(`
        select e.*, count(se.id)::int as schedule_count
        from events e
        left join event_schedule_entries se on se.event_id = e.id
        group by e.id
        order by
          case e.status when 'published' then 1 when 'draft' then 2 when 'archived' then 3 else 4 end,
          coalesce(e.starts_at, e.created_at) desc
      `)
      const targets = await db.query<Record<string, unknown>>('select * from event_publish_targets order by target_key asc')
      const targetsByEvent = new Map<string, ReturnType<typeof mapPublishTarget>[]>()
      for (const row of targets.rows) {
        const target = mapPublishTarget(row)
        const list = targetsByEvent.get(target.eventId) ?? []
        list.push(target)
        targetsByEvent.set(target.eventId, list)
      }
      const mappedEvents = events.rows.map((row) => {
        const event = mapEvent(row)
        return {
          ...event,
          publishTargets: targetsByEvent.get(event.id) ?? [],
          scheduleCount: Number(row.schedule_count ?? 0),
        }
      })
      return {
        metrics: {
          published: mappedEvents.filter((event) => event.status === 'published').length,
          drafts: mappedEvents.filter((event) => event.status === 'draft').length,
          archived: mappedEvents.filter((event) => event.status === 'archived').length,
          feeds: targets.rows.filter((row) => row.enabled).length,
        },
        events: mappedEvents,
      }
    },

    async getAdminEvent(idOrCode: string) {
      const eventResult = await db.query<Record<string, unknown>>(
        'select * from events where id::text = $1 or event_code = $1 limit 1',
        [idOrCode],
      )
      const eventRow = eventResult.rows[0]
      if (!eventRow) return null
      const event = mapEvent(eventRow)
      const [scheduleEntries, publishTargets, auditPreview] = await Promise.all([
        db.query<Record<string, unknown>>('select * from event_schedule_entries where event_id = $1 order by priority asc, starts_at asc', [event.id]),
        db.query<Record<string, unknown>>('select * from event_publish_targets where event_id = $1 order by target_key asc', [event.id]),
        db.query<Record<string, unknown>>(
          "select * from audit_events where target_type = 'event' and target_id = $1 order by created_at desc limit 10",
          [event.id],
        ),
      ])
      return {
        event,
        scheduleEntries: scheduleEntries.rows.map(mapScheduleEntry),
        publishTargets: publishTargets.rows.map(mapPublishTarget),
        auditPreview: auditPreview.rows.map((row) => ({
          id: String(row.id),
          actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
          actorExternalId: row.actor_external_id ? String(row.actor_external_id) : null,
          type: String(row.type),
          targetType: row.target_type ? String(row.target_type) : null,
          targetId: row.target_id ? String(row.target_id) : null,
          data: row.data as Record<string, unknown>,
          previousHash: row.previous_hash ? String(row.previous_hash) : null,
          eventHash: row.event_hash ? String(row.event_hash) : null,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
      }
    },

    async listPublicEvents() {
      const rows = await db.query<Record<string, unknown>>(`
        select * from events
        where status = 'published'
        order by coalesce(starts_at, created_at) asc
      `)
      return Promise.all(rows.rows.map(async (row) => {
        const event = mapEvent(row)
        const schedule = await db.query<Record<string, unknown>>(
          'select * from event_schedule_entries where event_id = $1 and public = true order by priority asc, starts_at asc',
          [event.id],
        )
        return {
          eventCode: event.eventCode,
          workspace: event.workspace,
          title: event.title,
          slug: event.slug,
          category: event.category,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          timezone: event.timezone,
          summary: event.summary,
          description: event.description,
          publicUrl: event.publicUrl,
          scheduleEntries: schedule.rows.map(mapScheduleEntry),
        }
      }))
    },

    async listEventFeedForTarget(targetKey: string) {
      const rows = await db.query<Record<string, unknown>>(`
        select e.*
        from events e
        join event_publish_targets t on t.event_id = e.id
        where e.status = 'published'
          and t.enabled = true
          and t.target_key = $1
        order by coalesce(e.starts_at, e.created_at) asc
      `, [targetKey])
      const events = []
      for (const row of rows.rows) {
        const event = mapEvent(row)
        const scheduleEntries = await db.query<Record<string, unknown>>(
          'select * from event_schedule_entries where event_id = $1 and public = true order by priority asc, starts_at asc',
          [event.id],
        )
        events.push({
          ...event,
          scheduleEntries: scheduleEntries.rows.map(mapScheduleEntry),
        })
      }
      return {
        targetKey,
        events,
      }
    },

    async listAdminSystems(): Promise<AdminSystemsListResponse> {
      const systems = await db.query<Record<string, unknown>>('select * from systems order by category asc, name asc')
      const heartbeats = await db.query<Record<string, unknown>>(`
        select distinct on (system_id) *
        from system_heartbeats
        order by system_id, received_at desc
      `)
      const heartbeatBySystem = new Map(heartbeats.rows.map((row) => [String(row.system_id), mapHeartbeat(row)]))
      const rows = systems.rows.map((row) => ({
        ...mapSystem(row),
        latestHeartbeat: heartbeatBySystem.get(String(row.id)) ?? null,
      }))
      const groups = new Map<string, typeof rows>()
      for (const row of rows) {
        const list = groups.get(row.category) ?? []
        list.push(row)
        groups.set(row.category, list)
      }
      return {
        metrics: {
          healthy: rows.filter((row) => row.status === 'healthy').length,
          warning: rows.filter((row) => row.status === 'warning').length,
          critical: rows.filter((row) => row.status === 'critical').length,
          monitored: rows.length,
        },
        groups: Array.from(groups.entries()).map(([category, systemsForCategory]) => ({
          category: category as AdminSystemsListResponse['groups'][number]['category'],
          title: category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
          systems: systemsForCategory,
        })),
      }
    },

    async recordSystemHeartbeat(input: BridgeSystemHeartbeatInput) {
      const existingResult = await db.query<Record<string, unknown>>('select * from systems where system_key = $1 limit 1', [input.systemKey])
      const existing = existingResult.rows[0] ? mapSystem(existingResult.rows[0]) : null
      const systemResult = await db.query<Record<string, unknown>>(`
        insert into systems (system_key, name, category, environment, status, updated_at)
        values ($1, $2, $3, 'production', $4, now())
        on conflict (system_key) do update set
          name = coalesce(excluded.name, systems.name),
          category = excluded.category,
          status = excluded.status,
          updated_at = now()
        returning *
      `, [
        input.systemKey,
        input.name ?? input.systemKey,
        input.category ?? 'backend',
        input.status,
      ])
      const system = mapSystem(systemResult.rows[0])
      const heartbeat = await db.query<Record<string, unknown>>(`
        insert into system_heartbeats (system_id, source, status, metrics, issues, sent_at)
        values ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
        returning *
      `, [
        system.id,
        input.source,
        input.status,
        JSON.stringify(input.metrics ?? {}),
        JSON.stringify(input.issues ?? []),
        input.sentAt ?? null,
      ])
      return {
        system,
        heartbeat: mapHeartbeat(heartbeat.rows[0]),
        previousStatus: existing?.status ?? null,
      }
    },
  }
}
