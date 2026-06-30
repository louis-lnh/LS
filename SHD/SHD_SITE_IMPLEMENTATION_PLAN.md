# SHD Esports Website Implementation Plan

## Decisions

### Stack

Use a single full-stack Next.js app for the SHD public website and team-content backend.

Recommended project:

```text
B:\LS\SHD\shd-site
```

Recommended stack:

- Next.js App Router.
- TypeScript.
- SQLite for local development and first production slice.
- Prisma or Drizzle for schema and migrations.
- Server-side API routes for public data, admin mutations, and internal bot actions.
- Shared validation with Zod.

This keeps the first version small while still leaving a clean path to hosted Postgres later.

### Admin Surface

Use the existing global admin portal at:

```text
B:\LS\admin-portal
```

The admin portal should become the unified staff cockpit for Lifesteal, General SHD, Valorant, and SHD Premier team content.

The SHD team website backend should expose admin-shaped endpoints that the existing portal can consume through:

```env
VITE_SHD_ADMIN_API_BASE_URL
```

Important boundary:

- The admin portal is the UI.
- `shd-site` owns SHD Premier content.
- `discord-bot` controls and announces things through trusted API calls.
- Lifesteal backend remains separate.

Do not put SHD Premier roster/match/clip data into the Discord bot JSON store.

## Target Architecture

```text
Public visitors
  -> shd-site public pages
  -> shd-site public API/data loaders
  -> shd-site database

Admin staff
  -> admin-portal
  -> shd-site admin API
  -> shd-site database

Discord staff commands
  -> SHD Discord bot
  -> shd-site internal API
  -> shd-site database
  -> optional Discord guild announcements

Website events
  -> shd-site webhook/outbox
  -> SHD Discord bot or Discord webhook
  -> guild channels
```

## Data Model

### Player

Fields:

- `id`
- `displayName`
- `handle`
- `riotName`
- `riotTag`
- `role`
- `preferredAgents`
- `bio`
- `avatarUrl`
- `socials`
- `status`: `main`, `sub`, `staff`, `inactive`
- `sortOrder`
- `createdAt`
- `updatedAt`

### Match

Fields:

- `id`
- `startsAt`
- `opponent`
- `eventType`: `premier`, `scrim`, `tournament`, `showmatch`
- `status`: `scheduled`, `completed`, `cancelled`
- `result`: `win`, `loss`, `draw`, `pending`
- `ourScore`
- `opponentScore`
- `maps`
- `vodUrl`
- `reviewNotes`
- `keyTakeaways`
- `mvpPlayerId`
- `featured`
- `announceToDiscord`
- `createdAt`
- `updatedAt`

### Clip

Fields:

- `id`
- `title`
- `playerId`
- `map`
- `sourceUrl`
- `embedUrl`
- `thumbnailUrl`
- `tags`
- `featured`
- `publishedAt`
- `createdAt`
- `updatedAt`

### Announcement

Fields:

- `id`
- `title`
- `body`
- `kind`: `match`, `result`, `roster`, `clip`, `site`
- `public`
- `discordMessageId`
- `publishedAt`
- `createdAt`
- `updatedAt`

### Stat Snapshot

Fields:

- `id`
- `seasonLabel`
- `wins`
- `losses`
- `mapsPlayed`
- `roundDifference`
- `mapStats`
- `agentUsage`
- `playerHighlights`
- `updatedAt`

Stats can start as manual snapshots and later become derived from match records.

## API Routes

### Public API

```http
GET /api/public/bootstrap
GET /api/public/roster
GET /api/public/matches
GET /api/public/clips
GET /api/public/stats
GET /api/public/announcements
```

### Admin API

These should be shaped for the existing admin portal.

```http
GET    /api/admin/shd-premier/bootstrap
GET    /api/admin/shd-premier/roster
POST   /api/admin/shd-premier/roster
PATCH  /api/admin/shd-premier/roster/:id
DELETE /api/admin/shd-premier/roster/:id

GET    /api/admin/shd-premier/matches
POST   /api/admin/shd-premier/matches
PATCH  /api/admin/shd-premier/matches/:id
DELETE /api/admin/shd-premier/matches/:id

GET    /api/admin/shd-premier/clips
POST   /api/admin/shd-premier/clips
PATCH  /api/admin/shd-premier/clips/:id
DELETE /api/admin/shd-premier/clips/:id

GET    /api/admin/shd-premier/stats
PUT    /api/admin/shd-premier/stats

GET    /api/admin/shd-premier/announcements
POST   /api/admin/shd-premier/announcements
PATCH  /api/admin/shd-premier/announcements/:id
DELETE /api/admin/shd-premier/announcements/:id
```

### Internal Bot API

Authenticated with a server-to-server token.

```http
POST /api/internal/bot/matches
POST /api/internal/bot/matches/:id/result
POST /api/internal/bot/vods
POST /api/internal/bot/clips
POST /api/internal/bot/roster
POST /api/internal/bot/premier-record
POST /api/internal/bot/announcements
```

Use:

```http
Authorization: Bearer <SHD_SITE_INTERNAL_TOKEN>
X-SHD-Actor: discord-bot
```

## Admin Portal Additions

Add a new workspace or section:

```text
Valorant / SHD Premier
```

Recommended admin views:

- Overview: current record, next match, latest result, featured clip, content health.
- Roster: player table and edit drawer/modal.
- Matches: scheduled/completed matches, result entry, VOD/review notes.
- Clips: clip list, featured toggle, source URL validation.
- Stats: manual season snapshot editor.
- Announcements: create public updates and choose whether to announce in Discord.
- Audit: merged into existing global audit later.

The portal should call `shd-site`, not the Discord bot, for Premier content.

## Discord Bot Coverage

The bot should eventually cover most day-to-day content actions:

```text
/match add
/match result
/vod add
/clip add
/roster update
/premier record
/announce
```

Bot responsibilities:

- Let trusted staff update website content from Discord.
- Send match/result/clip/roster announcements to configured guild channels.
- Trigger website updates through `shd-site` internal API.
- Never be the only database for website content.

Website/backend responsibilities:

- Store source-of-truth content.
- Validate all mutations.
- Return public website data.
- Track publish state and Discord announcement IDs where useful.

## MVP Scope

The MVP is a ready website and backend/bot architecture, without requiring real final content or live Riot integration.

Included:

- Public website layout for Home, Roster, Matches, Clips, Stats, About.
- Seed/demo content.
- Database schema and seed script.
- Public API routes.
- Admin API route shape.
- Internal bot API route shape.
- Existing admin portal prepared for SHD Premier section.
- Discord bot integration plan and command contracts.

Not included in MVP:

- Riot API.
- Public accounts.
- Automated match imports.
- Complex legal/event subdomain terms.
- Large community member ecosystem.

## Build Order

1. Scaffold `B:\LS\SHD\shd-site`.
2. Create the database schema, seed data, and content access layer.
3. Build public website pages with seeded/demo data.
4. Add public API endpoints.
5. Add admin/internal API endpoints with token auth.
6. Add SHD Premier views to `B:\LS\admin-portal`.
7. Add bot client helpers and stub commands that call the internal API.
8. Verify the public website, admin portal, and bot API contracts locally.

## Future Enhancements

- Discord OAuth admin auth reuse across `shd-site`.
- Hosted Postgres migration.
- Discord webhook outbox with retry handling.
- Riot API as optional enrichment.
- Derived stats from match records.
- Clip ingestion helpers for YouTube, Twitch, Medal, or local uploads.
