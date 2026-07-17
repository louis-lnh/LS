# Lifesteal Bot Portal Backend - Current Hosting and API Shape

This document describes how the Lifesteal Discord bot currently acts as the backend for the public support portal, the staff/admin portal, and the Lifesteal public pages. It is meant as the reference before redesigning the support and admin portals.

The important architecture point: SHD currently has more than one Discord bot/backend for different guilds. The details below describe the Lifesteal bot in `discord-bot/`. New portal work should keep guild-specific values, API secrets, Discord OAuth config, channel IDs, and datastore files separated per bot/guild.

## Runtime Model

The Lifesteal bot is both:

- A Discord bot for slash commands, ticket panels, staff actions, and Discord role sync.
- An Express HTTP API server started by `startWebServer(client)` in `src/web.js`.

The HTTP API listens on `PORT` from `.env`, defaulting to `3000`.

The bot stores its state in JSON at:

```text
discord-bot/data/lifesteal-bot.json
```

The most relevant collections for portal redesign are:

- `lifesteal_identities`: SHD IDs such as `SHD0001`, with Discord and Minecraft identity data.
- `linked_accounts`: active linked Discord/Minecraft accounts, public stats opt-in, risk/status data.
- `ticket_threads`: Discord ticket thread records and ticket answers/metadata.
- `support_applications`: old support portal Lifesteal signup submissions.
- `support_submissions`: old portal ban appeals, player reports, and Minecraft support requests.
- `appeals`: bot-created appeal records, including appeal tickets.
- `anti_cheat_records`: new SHD anti-cheat AP/EV records received from the Minecraft mod.
- `public_lifesteal_snapshot`: public player list/objective data from role sync.
- `admin_staff_access`: admin portal staff access records.
- `audit_events`: audit trail used by admin portal and logs.

## Environment Values

Core bot/API values:

```text
DISCORD_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
PUBLIC_BASE_URL
PORT
API_SHARED_SECRET
IP_HASH_SECRET
SUPPORT_PORTAL_URL
```

Admin portal values:

```text
ADMIN_PORTAL_URL
ADMIN_OAUTH_REDIRECT_URL
DISCORD_CLIENT_SECRET
ADMIN_SESSION_SECRET
ADMIN_OWNER_IDS
ADMIN_LIFESTEAL_STAFF_CHANNEL_ID
ADMIN_LIFESTEAL_EVENT_CHANNEL_ID
```

Minecraft/RCON values used by staff actions:

```text
MINECRAFT_RCON_ENABLED
MINECRAFT_RCON_HOST
MINECRAFT_RCON_PORT
MINECRAFT_RCON_PASSWORD
```

The Minecraft server mod should point at this bot with:

```text
LIFESTEAL_DISCORD_IDENTITY_ENDPOINT=https://<bot-domain>/api/v1/lifesteal/identity/minecraft/{minecraftUuid}
LIFESTEAL_DISCORD_ANTICHEAT_RECORD_ENDPOINT=https://<bot-domain>/api/v1/minecraft/anticheat-record
LIFESTEAL_DISCORD_ROLE_SYNC_ENDPOINT=https://<bot-domain>/api/v1/gameplay/roles/sync
LIFESTEAL_DISCORD_ROLE_SYNC_INTERVAL_SECONDS=60
LIFESTEAL_DISCORD_API_SHARED_SECRET=<same secret as API_SHARED_SECRET>
```

The bot itself currently reads the shared API secret as `API_SHARED_SECRET`; the Minecraft mod sends the same value under its own env name.

## Frontend Hosting Relationship

The support and admin portals are not served as full frontend apps by the bot. They are separate frontend projects/pages that call the bot API.

Current relationships:

- Public support portal frontend uses public endpoints under `/api/v1/public/...`.
- Admin portal frontend uses protected endpoints under `/api/v1/admin/...`.
- Lifesteal public pages use public read endpoints under `/api/v1/public/...`.
- Minecraft server/mod and server agent use protected endpoints with `API_SHARED_SECRET`.

The bot does serve a legacy verification HTML page at `/verify/:token`, but this should not be treated as the main future support UI.

## API Protection

There are three main API access levels.

Public read:

- Uses public rate limits.
- No shared secret.
- Used by public Lifesteal pages.

Public write:

- Uses public write rate limits.
- No shared secret.
- Used by old public support forms.
- Still validates input with Zod schemas.

Protected machine API:

- Requires `API_SHARED_SECRET`.
- Used by Minecraft server/mod, server agent, and internal service calls.

Admin API:

- Mounted under `/api/v1/admin`.
- Uses Discord OAuth login.
- Uses signed HTTP-only cookie `shd_admin_session`.
- CORS only allows `ADMIN_PORTAL_URL`.
- Access is computed from owner IDs, hardcoded owner ID, and `admin_staff_access`.

## Public Lifesteal Page Endpoints

These power the Lifesteal website/player list style pages:

```text
GET /api/v1/public/status
GET /api/v1/public/players
GET /api/v1/public/players/by-name/:name
GET /api/v1/public/players/:minecraftUuid
GET /api/v1/public/players/:minecraftUuid/timeline
GET /api/v1/public/leaderboard?sort=hearts|kills|deaths|revivals
GET /api/v1/public/objectives
GET /api/v1/public/season
GET /api/v1/public/sync-health
GET /api/v1/public/events
```

Public player data comes from `/api/v1/gameplay/roles/sync`. Only active linked players with public stats enabled are included. Private Discord IDs, moderation state, risk data, anti-cheat records, notes, IP hashes, and appeal context are not exposed publicly.

## Old Support Portal API

The current old support portal still has public form endpoints:

```text
POST /api/v1/public/rules/acknowledge
POST /api/v1/public/support/lifesteal-signup
POST /api/v1/public/support/minecraft-ban-appeal
POST /api/v1/public/support/minecraft-player-report
POST /api/v1/public/support/minecraft-support
```

Old application flow:

1. User reads rules and calls `/api/v1/public/rules/acknowledge`.
2. Bot returns a temporary rules key.
3. User submits `/api/v1/public/support/lifesteal-signup` with the rules key and answers.
4. Bot creates a `support_applications` record and returns an application key such as `SHD-APP-ABC123`.
5. User posts the application key into a Discord ticket.
6. Bot verifies/claims/reviews through ticket/admin flows.

This old page flow is being replaced by Discord ticket-first support, but the data shape is still useful for admin portal compatibility.

Old support form shapes:

- Lifesteal signup: Discord username/ID, Minecraft name, region/timezone, found server, experience, motivation, team/content.
- Ban appeal: Discord username, Minecraft name, ban ID, punishment type/date/reason, context/change/evidence.
- Player report: Discord username, reporter Minecraft name, reported player, category, incident time/location, description/evidence/witnesses.
- Minecraft support: Discord username, optional Minecraft name, category, summary, details/error/evidence.

## New Discord Ticket Support Flow

The newer support direction is Discord ticket-first. The user should not need several pages to identify themselves.

The Discord support panel has multiple buttons in one panel:

- Apply / Join Lifesteal
- Ban Appeals
- Report Player

### Apply / Join Lifesteal

User opens a ticket and is asked for their Minecraft username before the thread is created.

The bot resolves the Minecraft profile, creates/ensures a Lifesteal SHD identity, and creates a `ticket_threads` record:

```text
type: lifesteal_join
discord_id: user Discord ID
shd_id: SHDxxxx
minecraft_uuid
minecraft_name
answers.source: new_support_panel
```

The bot message shows:

- Discord username
- Discord user ID
- SHD ID
- Minecraft name
- Minecraft UUID

Staff uses `/confirm` in the join ticket. `/confirm`:

- Only works in `lifesteal_join` ticket threads.
- Ensures the Lifesteal identity.
- Upserts the linked account.
- Enables public stats.
- Accepts current Lifesteal rules for the player.
- Attempts whitelist via RCON.
- Marks the ticket solved with `solvedAt`, `confirmedAt`, and `autoCloseAt`.
- The ticket auto-closes after 12 hours.

### Ban Appeals

User presses the appeal button. The bot opens the appeal thread immediately; the user does not need to enter a ban ID before joining.

The bot:

- Finds the user's linked account or Lifesteal identity.
- Looks up `anti_cheat_records` by Minecraft UUID or SHD ID.
- Stores the latest AP/EV records in `ticket_threads.answers.antiCheatAppeals`.
- Creates an `appeals` row.
- Creates a `ticket_threads` row with `type: lifesteal_appeal`.

The ticket embed shows:

- Discord username
- Discord user ID
- SHD ID
- Minecraft name
- Minecraft UUID
- Latest anti-cheat appeal ID, such as `AP-1234`, when available
- Latest evidence ID, such as `EV-1234`, when available
- Prior anti-cheat appeal IDs/timestamps if multiple exist
- Blocked mods from anti-cheat context, when relevant

Staff uses:

- `/approve` inside appeal tickets only.
- `/deny` inside any ticket.
- `/close-ticket` if the ticket needs to close instantly.
- `/add user` to add another Discord user to the thread.

`/approve` for appeals:

- Runs Minecraft unban through RCON: `pardon <minecraftName>`.
- Marks the matching anti-cheat AP/EV record as `resolution_status: approved`.
- Stores resolver ID, resolution timestamp, and note in `anti_cheat_records`.
- Marks the ticket solved and sets `autoCloseAt` for 12 hours.
- Does not require a close reason after approval.

`/deny` for appeals:

- Marks the ticket solved and denied.
- If the ticket has AP/EV data, marks the anti-cheat record as `resolution_status: denied`.
- Sets `autoCloseAt` for 12 hours.
- Does not require a close reason after denial.

### Player Reports

User opens a report ticket and enters the reported player's Minecraft name before thread creation.

The bot resolves the reported player profile and creates/ensures an identity for that reported player.

The report ticket stores:

```text
type: lifesteal_report
discord_id: reporter Discord ID
shd_id: reporter SHD ID
minecraft_uuid: reporter Minecraft UUID if linked
minecraft_name: reporter Minecraft name if linked
answers.reportedShdId
answers.reportedMinecraftUuid
answers.reportedMinecraftName
answers.source: new_support_panel
```

The ticket embed shows both reporter and reported-player identity blocks.

Staff uses `/acknowledge` inside report tickets only. Options:

- `acknowledged`
- `investigation`
- `temp_ban`
- `ban`

For `temp_ban`, the bot sends RCON:

```text
tempban <reportedMinecraftName> <duration> <reason>
```

The Lifesteal server mod now provides that `/tempban` command. It writes a normal Minecraft user-ban entry with an expiry and disconnects the player if online.

For `ban`, the bot sends RCON:

```text
ban <reportedMinecraftName> <reason>
```

All `/acknowledge` actions mark the ticket solved and schedule auto-close after 12 hours. Solved tickets do not require a close reason.

## Ticket Command Policy

Current temporary command polish:

```text
/confirm       join/apply tickets only
/approve       appeal tickets only
/deny          any ticket
/acknowledge   report tickets only
/close-ticket  any ticket, instant close
/add           any ticket, add Discord user to thread
```

All of these commands are staff-only. Staff access comes from Discord `ModerateMembers` permission or configured `STAFF_ROLE_IDS`.

Removed from active command registration/dispatch:

```text
/appeal
/case
/deny old account flow
/flag
/profile
/risk
/risklist
/signup
/verify
/approve old account/application flow
```

Some old helper functions still exist in code for compatibility/history, but the slash commands are no longer registered or dispatched.

## Anti-Cheat Appeal Data Flow

The Minecraft server mod creates player-facing AP/EV records for anti-cheat disconnects/bans.

Player disconnect example:

```text
Disconnected by SHD Anti-Cheat
Reason: Blocked client mods reported
SHD0001 / AP-1234
You may appeal in Discord
```

For temp bans:

```text
You are temporarily suspended from playing on this server
Reason: ...
Suspension ends: ...
SHD0001 / AP-1234
You may appeal in Discord
```

For permanent bans:

```text
You are banned from playing on this server
Reason: ...
SHD0001 / AP-1234
You may appeal in Discord
```

The player sees SHD ID and AP ID, not the evidence ID. The bot stores both AP ID and EV ID.

The server mod posts anti-cheat records to:

```text
POST /api/v1/minecraft/anticheat-record
Authorization: shared secret
```

Payload fields:

```text
evidenceId
appealId
minecraftUuid
minecraftName
shdId
action
category
severity
reasonCode
publicReason
world
x/y/z
context
occurredAt
expiresAt
```

The bot resolves the Discord/SHD identity where possible and stores the record in `anti_cheat_records`. Appeal tickets then look up those records by Minecraft UUID or SHD ID.

Blocked mod records include context like:

```text
mods=[freecam, meteorclient] total=...
```

The appeal ticket parser extracts those blocked mods and displays them to staff.

## Admin Portal API

The admin portal API is mounted at:

```text
/api/v1/admin
```

Auth/session endpoints:

```text
GET  /api/v1/admin/auth/login
GET  /api/v1/admin/auth/callback
GET  /api/v1/admin/auth/session
POST /api/v1/admin/auth/logout
```

Core dashboard/staff endpoints:

```text
GET    /api/v1/admin/bootstrap
GET    /api/v1/admin/staff
POST   /api/v1/admin/staff
PATCH  /api/v1/admin/staff/:staffId
DELETE /api/v1/admin/staff/:staffId
GET    /api/v1/admin/audit
```

Review/workload endpoints:

```text
GET  /api/v1/admin/submissions
GET  /api/v1/admin/submissions/:code/ticket-activity
POST /api/v1/admin/submissions/:code/ticket-activity
POST /api/v1/admin/submissions/:code/claim
POST /api/v1/admin/submissions/:code/notes
POST /api/v1/admin/submissions/:code/decision
```

Player management endpoints:

```text
GET    /api/v1/admin/players
POST   /api/v1/admin/players
PATCH  /api/v1/admin/players/:playerId
DELETE /api/v1/admin/players/:playerId
```

Lifesteal operations endpoints:

```text
GET    /api/v1/admin/lifesteal/events
GET    /api/v1/admin/lifesteal/server-status
POST   /api/v1/admin/lifesteal/events
PATCH  /api/v1/admin/lifesteal/events/:eventId
POST   /api/v1/admin/lifesteal/events/:eventId/announcement
DELETE /api/v1/admin/lifesteal/events/:eventId
```

Staff chat bridge:

```text
GET  /api/v1/admin/staff-chat/lifesteal
POST /api/v1/admin/staff-chat/lifesteal
```

Admin portal authorization is workspace/permission based. Important permissions include:

- `global:read`
- `global:admin`
- `lifesteal:read`
- `lifesteal:review`
- `lifesteal:ticket`
- `lifesteal:staff-chat`
- `lifesteal:players`
- `lifesteal:events`

The admin portal currently normalizes review work from both:

- `support_applications`
- `support_submissions`

Future redesign should also treat `ticket_threads`, `appeals`, and `anti_cheat_records` as first-class review sources because the new support flow is ticket-first.

## Protected Minecraft/Server API

Identity/link endpoints:

```text
GET /api/v1/link/discord/:discordId
GET /api/v1/lifesteal/identity/:shdId
GET /api/v1/lifesteal/identity/minecraft/:minecraftUuid
POST /api/v1/minecraft/join
POST /api/v1/minecraft/link
POST /api/v1/minecraft/event
```

Server agent endpoints:

```text
POST /api/v1/server/heartbeat
GET  /api/v1/server/status
GET  /api/v1/server/status/:serverId
GET  /api/v1/server/history/:serverId
GET  /api/v1/server/actions/pending
POST /api/v1/server/actions/:actionId/result
POST /api/v1/server/log-event
```

Gameplay/public stats sync:

```text
POST /api/v1/gameplay/roles/sync
```

Anti-cheat record sync:

```text
POST /api/v1/minecraft/anticheat-record
```

## Redesign Notes

Recommended direction for the support portal redesign:

- Keep the public page as an informational/maintenance/front-door page while ticket-first support is active.
- Avoid asking users for AP/EV IDs on the web page if the Discord ticket can resolve them by SHD ID/Minecraft UUID.
- Make SHD ID the stable user-facing identifier.
- Keep AP IDs short, e.g. `AP-1234`, for player-facing disconnects.
- Keep EV IDs internal/staff-facing.
- Treat Discord tickets as the source of truth for apply, appeal, and report workflows until the redesigned portal can safely mirror those workflows.

Recommended direction for the admin portal redesign:

- Add native views for `ticket_threads`, `appeals`, and `anti_cheat_records`.
- Keep the existing `submissions` API shape stable or provide an adapter while the frontend is redesigned.
- Keep staff claim/ownership semantics because the current API already prevents conflicting review ownership.
- Keep Discord OAuth/session model for staff access.
- Keep guild-specific config isolated so the second Discord bot can reuse similar endpoint names without sharing data.

## Separation Rules for Two Bot Backends

Because SHD has two Discord bots/backends for two guilds, do not assume global shared state.

Per bot/guild, keep separate:

- Discord bot token and client ID.
- Discord guild ID.
- Staff role IDs.
- Channel IDs.
- API shared secret.
- Admin OAuth redirect URL.
- Admin portal URL.
- Data file/storage.
- Minecraft/server integration endpoints.

Endpoint names can stay similar across bots, but the deployed base URL and data source must identify which guild/project owns the request.
