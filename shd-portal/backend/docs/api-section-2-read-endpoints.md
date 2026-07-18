# Backend Section 2: Read API Contract

This document defines the first backend API shape for the redesigned SHD portal. These endpoints are read-only and are intended to make the admin portal pages real before adding write actions.

Base path:

```text
/api/v1
```

Admin endpoints require authenticated staff access. Public endpoints must only return published/public data.

## Response Envelope

All API responses should use one envelope shape.

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "not_found",
    "message": "Event not found."
  }
}
```

## Auth Expectations

For the first implementation, accept one of:

- portal session cookie
- admin bearer token for internal testing

Later:

- native SHD login session
- linked Discord OAuth identity
- scoped staff permissions

Recommended headers for internal/bot calls:

```text
Authorization: Bearer <shared-service-token>
X-SHD-Actor: discord-bot:lifesteal
```

## Admin Events

### GET /api/v1/admin/events

Returns grouped admin event records.

Query parameters:

| Name | Type | Notes |
| --- | --- | --- |
| status | string optional | `draft`, `published`, `archived`, `cancelled` |
| workspace | string optional | `global`, `lifesteal`, `valorant` |
| includeArchived | boolean optional | Defaults to `true` for admin |

Response:

```json
{
  "ok": true,
  "data": {
    "metrics": {
      "published": 2,
      "drafts": 2,
      "archived": 1,
      "feeds": 4
    },
    "events": [
      {
        "id": "uuid",
        "eventCode": "EVT-2001",
        "parentEventId": null,
        "workspace": "lifesteal",
        "title": "SHD Lifesteal Beta Season",
        "slug": "shd-lifesteal-beta-season",
        "category": "minecraft",
        "status": "published",
        "startsAt": "2026-07-23T18:00:00+02:00",
        "timezone": "Europe/Berlin",
        "summary": "Lifesteal beta season.",
        "publicUrl": "https://lifesteal.shd-esports.com",
        "publishTargets": [
          {
            "targetType": "website",
            "targetKey": "lifesteal-site",
            "enabled": true,
            "lastSyncedAt": null,
            "lastError": null
          }
        ],
        "createdAt": "2026-07-17T20:00:00Z",
        "updatedAt": "2026-07-17T20:00:00Z"
      }
    ]
  }
}
```

### GET /api/v1/admin/events/:eventCodeOrId

Returns one event with schedule entries and publish targets.

Response:

```json
{
  "ok": true,
  "data": {
    "event": {},
    "scheduleEntries": [],
    "publishTargets": [],
    "auditPreview": []
  }
}
```

## Public Events

### GET /api/v1/public/events

Returns only published, public events. Archived/draft/cancelled events are hidden.

Query parameters:

| Name | Type | Notes |
| --- | --- | --- |
| workspace | string optional | Example `lifesteal` |
| category | string optional | Example `minecraft` |

### GET /api/v1/public/events/:slug

Returns one public event by slug.

Rules:

- only `published` events
- only enabled public publish targets
- include public schedule entries

## Admin Systems

### GET /api/v1/admin/systems

Returns overview metrics and grouped systems.

Response:

```json
{
  "ok": true,
  "data": {
    "metrics": {
      "healthy": 11,
      "warning": 3,
      "critical": 1,
      "monitored": 15
    },
    "groups": [
      {
        "category": "minecraft_server",
        "title": "Game Servers",
        "systems": [
          {
            "id": "uuid",
            "systemKey": "lifesteal-g17",
            "name": "Lifesteal Minecraft Server",
            "status": "critical",
            "environment": "production",
            "latestHeartbeat": {
              "receivedAt": "2026-07-17T20:00:00Z",
              "source": "shd-agent",
              "metrics": {},
              "issues": []
            }
          }
        ]
      }
    ]
  }
}
```

### GET /api/v1/admin/systems/:systemKey

Returns one system with latest heartbeat, recent heartbeat history, linked services, and recent actions.

Response:

```json
{
  "ok": true,
  "data": {
    "system": {},
    "latestHeartbeat": {},
    "history": [],
    "recentActions": [],
    "linkedServices": []
  }
}
```

## Admin Support

### GET /api/v1/admin/support

Returns support review overview and queue rows.

Query parameters:

| Name | Type | Notes |
| --- | --- | --- |
| status | string optional | Filter by submission status |
| type | string optional | Filter by application/appeal/report/support |
| assignedTo | string optional | Staff user ID or `me` |

Response includes:

- metrics
- open submissions
- archived submissions

### GET /api/v1/admin/support/:submissionCodeOrId

Returns one submission with:

- submitter identity
- linked Discord and Minecraft accounts
- fields/answers
- review state
- linked chat preview
- anti-cheat records if appeal-related

## Admin Users

### GET /api/v1/admin/users

Returns grouped user list for owners, staff, and members.

Query parameters:

| Name | Type | Notes |
| --- | --- | --- |
| q | string optional | Search name, SHD ID, Discord ID, Minecraft name |
| role | string optional | Role filter |
| risk | string optional | Risk filter |

### GET /api/v1/admin/users/:shdIdOrUserId

Returns a full staff-visible user profile:

- SHD account
- roles
- linked Discord accounts
- linked Minecraft accounts
- open submissions
- archived submissions
- anti-cheat records
- recent audit events

## Bot/Internal Bridge Reads

### GET /api/v1/internal/identity/minecraft/:minecraftUuid

Used by Minecraft mod/server and bots to resolve:

- SHD ID
- Discord ID
- Minecraft username
- public profile eligibility
- role sync eligibility

### GET /api/v1/internal/anticheat-records

Query parameters:

| Name | Type | Notes |
| --- | --- | --- |
| shdId | string optional | SHD ID |
| minecraftUuid | string optional | Minecraft UUID |
| appealId | string optional | Appeal ID |
| evidenceId | string optional | Evidence ID |

## Implementation Order

1. `GET /api/v1/admin/events`
2. `GET /api/v1/admin/events/:eventCodeOrId`
3. `GET /api/v1/public/events`
4. `GET /api/v1/admin/systems`
5. `GET /api/v1/admin/systems/:systemKey`
6. `GET /api/v1/admin/users`
7. `GET /api/v1/admin/support`

Events should go first because they are low-risk and do not perform moderation, whitelist, ban, or remote system actions.
