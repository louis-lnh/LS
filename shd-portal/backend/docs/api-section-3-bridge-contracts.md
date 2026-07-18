# Backend Section 3: Bridge Contracts

Section 3 defines how the shared backend talks to systems that still need to stay operational while the portal backend grows:

- Lifesteal Discord bot
- main SHD Discord bot
- Lifesteal Minecraft server/mod
- SHD Agent
- public event websites

The backend should become the source of truth. Bots and agents should become bridges that send/receive specific events.

## Bridge Rules

- Bridge endpoints use service authentication, not user sessions.
- Every write must include a stable source identifier.
- Every bridge write should create an audit event.
- Bridge writes should be idempotent where possible.
- Discord bots may keep their local JSON/database during migration, but must eventually mirror from the shared backend.

Recommended service headers:

```text
Authorization: Bearer <service-token>
X-SHD-Service: lifesteal-discord-bot
X-SHD-Request-ID: uuid-or-stable-idempotency-key
```

## Service Names

Canonical service keys:

| Key | Owner | Purpose |
| --- | --- | --- |
| `lifesteal-discord-bot` | Lifesteal guild bot | Tickets, whitelist, role sync, Discord messages |
| `main-discord-bot` | Main SHD guild bot | Main guild workflows, announcements, future OAuth bridge |
| `lifesteal-minecraft-server` | Minecraft server/mod | Anti-cheat, identity lookup, public stats |
| `shd-agent-lifesteal-g17` | SHD Agent | Server health and future controlled actions |
| `lifesteal-website` | Public website | Event feed and player/event display |
| `shd-portal` | Portal frontend/backend | User/admin portal |

## Identity Bridge

### GET /api/v1/bridge/identity/minecraft/:minecraftUuid

Used by:

- Lifesteal mod/server
- Lifesteal Discord bot
- SHD Agent if it needs player context

Returns:

- SHD ID
- linked Discord account
- Minecraft account
- role/public profile state

### GET /api/v1/bridge/identity/shd/:shdId

Used by:

- staff Discord commands like `/whoisid`
- admin portal lookup
- support workflows

Returns the same identity payload, resolved by SHD ID.

## Anti-Cheat Bridge

### POST /api/v1/bridge/anticheat/records

Used by:

- Lifesteal mod/server
- future Grim/Xray bridge if they forward through SHD

Request:

```json
{
  "evidenceId": "EV-1234",
  "appealId": "AP-1234",
  "minecraftUuid": "6ad0d6d1-90ca-49aa-b5aa-d4c7e197b60e",
  "minecraftName": "PrimeLuigi",
  "shdId": "SHD0001",
  "action": "block_join",
  "category": "client_integrity",
  "severity": "critical",
  "reasonCode": "blocked_mod",
  "publicReason": "Blocked client mod reported",
  "detectedMods": [
    {
      "id": "xaerominimap",
      "name": "Xaero Minimap",
      "classification": "blocked"
    }
  ],
  "context": {
    "serverId": "lifesteal-g17",
    "source": "shd-lifesteal-mod"
  },
  "occurredAt": "2026-07-17T20:00:00Z",
  "expiresAt": null
}
```

Behavior:

- upsert by `evidenceId`
- preserve existing resolution state if already solved
- return canonical appeal/evidence data
- create notification for linked user if a user exists
- create audit event

### POST /api/v1/bridge/anticheat/records/:appealId/resolve

Used by:

- Lifesteal Discord bot after `/approve` or `/deny`
- admin portal later

Request:

```json
{
  "status": "approved",
  "resolvedByDiscordId": "1248919319967039498",
  "note": "Appeal approved from Discord ticket."
}
```

Behavior:

- updates anti-cheat record
- links staff user if known
- emits audit event
- can tell bot/mod whether a ban/temp-ban should be lifted

## Support/Ticket Bridge

### POST /api/v1/bridge/support/submissions

Used by:

- Discord bot while tickets remain active there
- portal once forms submit directly

Behavior:

- creates a canonical `support_submissions` row
- creates linked `chats` row
- stores form fields in `support_submission_fields`
- optionally stores Discord thread/channel/message references

### POST /api/v1/bridge/support/submissions/:submissionCode/status

Used by:

- Discord bot commands: `/confirm`, `/approve`, `/deny`, `/acknowledge`
- admin portal later

Request:

```json
{
  "action": "accepted",
  "staffDiscordId": "1248919319967039498",
  "reason": null,
  "closeAfterHours": 12
}
```

Behavior:

- writes `submission_reviews`
- updates submission status
- sends/queues a chat message
- optionally asks Lifesteal bot to whitelist/unban through its existing bridge until direct backend control exists

## Chat Bridge

### POST /api/v1/bridge/chats/:chatCode/messages

Used by:

- Discord bot when staff/user messages in ticket threads
- portal when user/staff messages in web chat

Request:

```json
{
  "senderType": "discord_bot",
  "senderDiscordId": "1248919319967039498",
  "body": "Your application was approved.",
  "discordMessageId": "1234567890"
}
```

Behavior:

- stores message once
- maps Discord messages to portal messages
- supports future two-way sync

## Event Publishing Bridge

### POST /api/v1/bridge/events/:eventCode/publish

Used by:

- admin backend after staff publishes an event

Behavior:

- marks event published
- pushes publish jobs to enabled targets:
  - public portal feed
  - Lifesteal website feed
  - Discord bot notification
  - Minecraft server event sync

### GET /api/v1/bridge/events/feed/:targetKey

Used by:

- Lifesteal website
- other event websites
- Discord bots

Returns published events and schedule entries enabled for that target.

## Systems Bridge

### POST /api/v1/bridge/systems/heartbeat

Used by:

- SHD Agent
- bots for heartbeat pings
- backend services if they self-report

Behavior:

- upserts/creates the system by `systemKey`
- appends `system_heartbeats`
- updates latest `systems.status`
- creates warnings if status worsens

### GET /api/v1/bridge/systems/actions/pending

Used by:

- SHD Agent only when actions are explicitly enabled

Default:

- should return empty list unless `ACTIONS_ENABLED` is true and backend allows it.

## Webhook/Event Names

Internal event names to use in audit/log/queue code:

| Event | Meaning |
| --- | --- |
| `identity.linked` | Discord/Minecraft identity was linked |
| `anticheat.recorded` | Anti-cheat record was received |
| `anticheat.resolved` | Appeal/evidence record was resolved |
| `support.submission.created` | New support submission |
| `support.submission.claimed` | Staff claimed a submission |
| `support.submission.resolved` | Support submission accepted/denied/resolved |
| `chat.message.created` | Chat message stored |
| `event.published` | Event became public |
| `event.archived` | Event stopped publishing |
| `system.heartbeat.received` | System heartbeat stored |
| `system.status.changed` | System status changed |

## First Bridge Implementation Recommendation

Implement bridges in this order:

1. `GET /api/v1/bridge/identity/minecraft/:minecraftUuid`
2. `POST /api/v1/bridge/anticheat/records`
3. `POST /api/v1/bridge/systems/heartbeat`
4. `GET /api/v1/bridge/events/feed/:targetKey`
5. `POST /api/v1/bridge/support/submissions`

This order supports the Lifesteal mod, anti-cheat appeals, SHD Agent health, and event website feeds before taking over sensitive ticket actions.
