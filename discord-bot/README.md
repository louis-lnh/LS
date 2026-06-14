# Lifesteal Discord Bot

Discord verification, Minecraft whitelisting, duplicate-account review, and moderation tooling for a Lifesteal server.

## What It Does

- Links a Discord account to one Minecraft Java account.
- Runs `/verify minecraft_name`, then finishes through a consent web page.
- Gives a one-time in-game `/link <code>` for the Fabric bridge flow, so Minecraft UUID ownership can be proven in-game.
- Stores keyed hashes of IP addresses, not raw IPs, for duplicate-account checks.
- Flags suspicious signups when another linked account used the same IP hash.
- Gives verified and gameplay Discord roles when configured.
- Tracks risk scores, signup answers, rules acceptance, appeals, alt links, and staff timelines.
- Optionally whitelists, kicks, and bans Minecraft users through RCON.
- Provides staff commands: `/whois`, `/risk`, `/risklist`, `/alts`, `/history`, `/note`, `/case`, `/flag`, `/purge`, `/kick`, `/ban`, `/unlink`.
- Provides player profile/event commands with `/profile`.
- Provides panel-based join and appeal ticket flows using Discord threads.
- Exposes protected API endpoints for future websites or a Minecraft plugin.

## Important Limits

Discord does not expose user IP addresses to bots. This bot can only collect IP information when:

- the user visits the verification web page, or
- your Minecraft server/plugin/proxy sends the join IP to `/api/v1/minecraft/join`.

The bot stores hashes so staff can detect duplicates without browsing raw IPs. You should still disclose this in your Discord rules/privacy notice before using it.

## Setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `IP_HASH_SECRET`, `RULES_VERSION`, and `API_SHARED_SECRET`.
   Optional gameplay roles use `MACE_ROLE_ID`, `TWENTY_HEARTS_ROLE_ID`, and `DRAGON_EGG_ROLE_ID`.
   Optional stream overlay state uses `OVERLAY_LIFESTEAL_PLAYER_UUID` and `OVERLAY_PUBLIC_TOKEN`.
   Rules panel roles use `DISCORD_RULES_ROLE_ID` and `LIFESTEAL_RULES_ROLE_ID`.
   Optional command hardening can use `STAFF_ROLE_IDS=role_id_1,role_id_2`.
   Optional separated logs use `SECURITY_LOG_CHANNEL_ID`, `MINECRAFT_LOG_CHANNEL_ID`, `APPEAL_LOG_CHANNEL_ID`, and `STAFF_AUDIT_CHANNEL_ID`.
   Optional ticket channels use `TICKET_NOTIFY_CHANNEL_ID` for staff new-ticket notifications and `TICKET_ARCHIVE_CHANNEL_ID` for saved ticket link badges.
4. In the Discord Developer Portal, enable these bot intents:
   - Server Members Intent
   - Message Content Intent, needed for some message moderation workflows
5. Invite the bot with these scopes:
   - `bot`
   - `applications.commands`
6. Give it permissions for the commands you want:
   - Manage Roles
   - Manage Messages
   - Kick Members
   - Ban Members
   - Moderate Members

Install and register:

```powershell
npm install
npm run register
npm start
```

## Local Testing

For real verification, `PUBLIC_BASE_URL` must be reachable by Discord users. For development you can use a tunnel:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Set `PUBLIC_BASE_URL` to the tunnel URL, then restart the bot.

## Admin portal OAuth

The bot API now provides the first protected admin backend layer:

```text
GET  /api/v1/admin/auth/login
GET  /api/v1/admin/auth/callback
GET  /api/v1/admin/auth/session
POST /api/v1/admin/auth/logout
GET  /api/v1/admin/bootstrap
GET  /api/v1/admin/submissions
POST /api/v1/admin/submissions/:code/claim
```

Add the exact callback URL to the Discord application under OAuth2 redirects. Production example:

```text
https://verify.shd-esports.com/api/v1/admin/auth/callback
```

Configure:

```env
ADMIN_PORTAL_URL=https://admin.shd-esports.com
ADMIN_OAUTH_REDIRECT_URL=https://verify.shd-esports.com/api/v1/admin/auth/callback
DISCORD_CLIENT_SECRET=your_discord_oauth_client_secret
ADMIN_SESSION_SECRET=a_long_random_secret
ADMIN_OWNER_IDS=1224803434675572827
```

Sessions use signed HTTP-only cookies. The API checks current guild membership and staff permissions before returning protected data. The Discord guild owner, configured `ADMIN_OWNER_IDS`, and administrators receive all workspaces; configured staff roles and moderators currently receive Lifesteal access.

`GET /api/v1/admin/submissions` returns a normalized, newest-first review collection built from Lifesteal applications, ban appeals, player reports, and Minecraft support submissions. It resolves Discord ticket claims into staff display names and exposes only the review fields required by the admin portal.

`POST /api/v1/admin/submissions/:code/claim` provides exclusive review ownership. Application claims reuse the linked Discord ticket claim, while other support records use their own atomic claim state. Repeated claims by the same staff member are idempotent; competing staff receive HTTP `409` with the current owner.

## Minecraft RCON

In `server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=long-random-password
white-list=true
```

Then set:

```env
MINECRAFT_RCON_ENABLED=true
MINECRAFT_RCON_HOST=127.0.0.1
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=long-random-password
```

When enabled, successful verification runs:

```text
whitelist add <minecraft_name>
```

Moderation commands can also run Minecraft `kick` or `ban` if staff select the Minecraft option.

## Protected API

All API routes require:

```http
Authorization: Bearer <API_SHARED_SECRET>
```

Lookup a Discord link:

```http
GET /api/v1/link/discord/:discordId
```

Minecraft join check for a future Fabric/proxy plugin:

```http
POST /api/v1/minecraft/join
Content-Type: application/json

{
  "minecraftUuid": "uuid",
  "minecraftName": "PlayerName",
  "ip": "203.0.113.5"
}
```

Complete in-game link code verification:

```http
POST /api/v1/minecraft/link
Content-Type: application/json

{
  "code": "AB12CD34",
  "minecraftUuid": "uuid",
  "minecraftName": "PlayerName",
  "ip": "203.0.113.5"
}
```

Send a structured Minecraft/server evidence event:

```http
POST /api/v1/minecraft/event
Content-Type: application/json

{
  "type": "blocked_item",
  "minecraftUuid": "uuid",
  "minecraftName": "PlayerName",
  "severity": "warning",
  "message": "Tried to use an end crystal",
  "data": {
    "item": "minecraft:end_crystal"
  }
}
```

Responses:

- `allowed: true` when the account is linked and active.
- `allowed: false` when unlinked, banned, under review, high risk, missing current rules acceptance, or IP lock mismatches.

## Security Workflow Commands

- `/risk` and `/risklist` show scored account risk with reasons.
- `/signup submit` stores onboarding answers; `/signup status` shows them.
- `/rules version`, `/rules accept`, and staff `/rules bump` manage rules acceptance.
- `/profile set` stores region, team, event interest, and public stats opt-in.
- `/panel create type:Join` posts the join panel in the current channel.
- `/panel create type:Appeal` posts the appeal panel in the current channel.
- `/appeal create` stores appeals; staff can `/appeal accept`, `/appeal deny`, or `/appeal close`.
- `/alts` shows full/prefix IP hash relationships and Minecraft UUID history.
- `/history` shows the user timeline from audit events, cases, appeals, and notes.
- `/note add`, `/note list`, and `/note delete` manage staff notes; `/case close` closes moderation cases.
- `/approve` releases reviewed users and `/deny` bans a reviewed link.
- `/sharedip approve` and `/sharedip list` manage sibling/roommate shared-IP exceptions.
- `/data backup` writes a local timestamped backup; `/data export` exports selected bot data as JSON.
- `/kick`, `/ban`, `/deny`, and `/unlink` require staff button confirmation before applying.

Gameplay role sync from the Fabric mod:

```http
POST /api/v1/gameplay/roles/sync
Content-Type: application/json

{
  "players": [
    {
      "playerId": "java-uuid-or-minecraftUuid",
      "twentyHearts": true,
      "dragonEggHolder": false,
      "maceWielder": true
    }
  ]
}
```

The endpoint also accepts `minecraftUuid` instead of `playerId`. It matches dashed Java UUIDs and compact Mojang UUIDs, skips unlinked or inactive accounts, and only manages configured gameplay roles. Treat this as a full sync: active linked members missing from the payload have managed gameplay roles removed, which keeps season resets clean.

If `OVERLAY_LIFESTEAL_PLAYER_UUID` is configured, this sync also persists only that player's latest Lifesteal state for stream overlays. Other received players are still used for Discord role sync, but they are not stored as overlay state.

Read the stored overlay player:

```http
GET /api/v1/overlays/lifesteal/player
```

If `OVERLAY_PUBLIC_TOKEN` is configured, pass it as `?token=...` or `Authorization: Bearer <OVERLAY_PUBLIC_TOKEN>`.

## Public Website API

These read-only routes are safe for the public website and do not require `API_SHARED_SECRET`:

```http
GET /api/v1/public/status
GET /api/v1/public/players
GET /api/v1/public/players/:minecraftUuid
GET /api/v1/public/players/by-name/:name
GET /api/v1/public/players/:minecraftUuid/timeline
GET /api/v1/public/leaderboard?sort=hearts|kills|deaths|revivals
GET /api/v1/public/objectives
GET /api/v1/public/season
GET /api/v1/public/sync-health
GET /api/v1/public/events
```

The public player list is populated by `/api/v1/gameplay/roles/sync`. Only linked, active players who opted into public stats through `/profile set public_stats:true` are published. Private Discord IDs, risk scores, IP hashes, moderation notes, appeals, and account-review state are never included.

Public status includes online/max player counts, grace-period state, source update time, and snapshot age. Public sync health reports whether the snapshot is `live`, `stale`, `offline`, or `waiting`. Public players expose website-facing fields such as `hearts_current`, `kills_total`, `deaths_total`, `revivals_total`, `heart_gains`, `heart_losses`, and `mace_kills`, with `data_status` values so the website can distinguish synced stats from unavailable stats. Public objectives expose dragon egg holder, mace holders, and 20-heart counts separately from the player list.

Public events are sanitized from Minecraft audit events and should only be used for public-safe event types or events explicitly marked with `"public": true` in their `data`.

## Support Signup Flow

The support portal uses a two-key flow for Lifesteal applications:

1. The player reads the Lifesteal rules and creates a rules acknowledgement key:

```http
POST /api/v1/public/rules/acknowledge
Content-Type: application/json

{
  "project": "lifesteal"
}
```

2. The support signup form submits that key with the application answers:

```http
POST /api/v1/public/support/lifesteal-signup
Content-Type: application/json

{
  "rulesCode": "SHD-RULES-ABC123",
  "discordUsername": "player_name",
  "discordId": "optional_discord_id",
  "minecraftName": "PlayerName",
  "region": "EU",
  "foundLifesteal": "Friend invited me",
  "experience": "Application answer",
  "motivation": "Application answer",
  "team": "Optional team name or teammates"
}
```

The bot returns an application key such as `SHD-APP-ABC123`. The player posts that key inside their Discord ticket. The bot verifies the rules key/application relationship, checks the Discord identity, marks the application as `ticket_verified`, replies in the ticket, and sends a staff review embed to `SUPPORT_APPLICATION_LOG_CHANNEL_ID` or the ticket/mod log fallback.

## Gameplay Roles

Optional role IDs:

```env
MACE_ROLE_ID=
TWENTY_HEARTS_ROLE_ID=
NINETEEN_HEARTS_ROLE_ID=
EIGHTEEN_HEARTS_ROLE_ID=
SEVENTEEN_HEARTS_ROLE_ID=
SIXTEEN_HEARTS_ROLE_ID=
FIFTEEN_HEARTS_ROLE_ID=
FOURTEEN_HEARTS_ROLE_ID=
THIRTEEN_HEARTS_ROLE_ID=
TWELVE_HEARTS_ROLE_ID=
ELEVEN_HEARTS_ROLE_ID=
TEN_HEARTS_ROLE_ID=
NINE_HEARTS_ROLE_ID=
EIGHT_HEARTS_ROLE_ID=
SEVEN_HEARTS_ROLE_ID=
SIX_HEARTS_ROLE_ID=
FIVE_HEARTS_ROLE_ID=
FOUR_HEARTS_ROLE_ID=
THREE_HEARTS_ROLE_ID=
TWO_HEARTS_ROLE_ID=
ONE_HEARTS_ROLE_ID=
ELIMINATED_ROLE_ID=
DRAGON_EGG_ROLE_ID=
```

The protected gameplay-role sync manages these roles from the Fabric mod. Heart roles are exclusive: a player keeps only the role matching their current heart count. Missing role IDs are ignored.

## Data

Local data file:

```text
data/lifesteal-bot.json
```

Collections:

- `linked_accounts`
- `verification_tokens`
- `moderation_cases`
- `audit_events`
- `minecraft_link_history`
- `minecraft_name_history`
- `discord_name_history`
- `rules_acceptances`
- `signup_answers`
- `appeals`
- `staff_notes`
- `shared_ip_exceptions`
- `ticket_threads`
- `app_settings`

Back this file up if the bot is authoritative for verification.

## Join And Appeal Panels

Use normal Ticket v2 for general support. Use this bot for gameplay-linked flows:

```text
/panel create type:Join
/panel create type:Appeal
```

Run each command in the channel where the panel should live, for example `#join-tickets` and `#appeal-tickets`.

Appeals:

- User clicks `Open Appeal`.
- Bot opens a modal for ban ID, Minecraft username, and appeal reason.
- Bot creates a thread under the panel channel and stores the appeal.

Join/signup:

- User clicks `Start Join Ticket`.
- Bot creates a thread under the panel channel.
- Bot asks signup questions one by one in the thread.
- Final answers are stored in `signup_answers`.
- If the user agreed to the rules, the bot posts a verification link and future `/link <code>` in the ticket after the final answer.
- Ticket threads include a staff-only close button that requires a close reason.
- Members with configured `STAFF_ROLE_IDS` are added to private ticket threads automatically when possible.
- `TICKET_NOTIFY_CHANNEL_ID` receives a staff notification with basic ticket details whenever a join or appeal ticket is created.
- `TICKET_ARCHIVE_CHANNEL_ID` receives a permanent saved-ticket badge with an `Open Thread` button for each created ticket.

The bot first tries to create private threads and falls back to public threads if Discord permissions or server features block private thread creation. Staff should have permission to view/manage private threads in those channels.

## Rules Panels

Post the simple role panels under the matching rules messages:

```text
/discord-rules-panel
/lifesteal-rules-panel
```

The buttons only grant the configured role and write an audit/log entry. They do not run Minecraft account verification.
