# SHD Discord Bot

Backend-first Discord bot for the SHD guild, websites, support flows, and future admin tooling.

## Current Scope

- Discord `/status` command.
- Discord `/panel ticket`, `/panel verify`, `/panel roles`, and `/setup check` commands.
- Button-based SHD verification and public role panels.
- Ticket panels for support, applications, appeals, reports, and partnerships.
- Ticket thread claim/close controls and website submission key linking.
- `GET /api/v1/health`.
- `GET /api/v1/public/status`.
- `POST /api/v1/public/support/submissions`.
- `POST /api/v1/public/support/contact`.
- `POST /api/v1/public/support/application`.
- `POST /api/v1/public/support/appeal`.
- `POST /api/v1/public/support/report`.
- `GET /api/v1/public/support/submissions/:code`.
- Protected `GET /api/v1/admin/bootstrap`.
- Protected `GET /api/v1/admin/audit`.
- Protected `GET /api/v1/admin/staff`.
- Discord OAuth admin session routes.
- Protected admin submission list/detail/claim/note/decision routes.
- Local JSON data store at `data/shd-bot.json`.
- Audit event logging.
- Staff/owner permission helpers.
- Config structure for SHD roles, channels, websites, and API secrets.

Game-specific features, Valorant tooling, advanced support workflows, and server-management features are intentionally out of the first slice.

## Setup

```powershell
cd B:\LS\SHD\discord-bot
npm install
copy .env.example .env
npm run register
npm start
```

Fill `.env` with the SHD bot token, client ID, guild ID, owner/staff role IDs, and `API_SHARED_SECRET` before running in a real guild.

The bot starts with only the non-privileged `Guilds` gateway intent. For richer guild workflows, enable the matching privileged intents in the Discord Developer Portal and set `ENABLE_GUILD_MEMBERS_INTENT=true` and `ENABLE_MESSAGE_CONTENT_INTENT=true`. Message content is required when users paste support keys into ticket threads.

## Scripts

```powershell
npm run check
npm run register
npm start
```

## Guild Panels

Staff can post Discord-native guild surfaces after commands are registered:

```powershell
npm run register
```

- `/panel verify`: posts the SHD accept/verify button and grants `SHD_VERIFIED_ROLE_ID`, plus `SHD_MEMBER_ROLE_ID` when configured.
- `/panel roles`: posts self-service role buttons for announcements, events, and support pings.
- `/panel ticket type:<type>`: posts ticket panels for support, application, appeal, report, or partnership flows.
- `/setup check`: reports missing role/channel config and intent-dependent features.

Ticket keys look like `SHD-APP-1A2B3C4D`, `SHD-SUP-1A2B3C4D`, `SHD-RPT-1A2B3C4D`, `SHD-APL-1A2B3C4D`, or `SHD-CON-1A2B3C4D`. Users paste them inside a ticket thread to attach their website submission to the Discord review.

## API

Public:

- `GET /api/v1/health`
- `GET /api/v1/public/status`
- `POST /api/v1/public/support/submissions`
- `POST /api/v1/public/support/contact`
- `POST /api/v1/public/support/application`
- `POST /api/v1/public/support/appeal`
- `POST /api/v1/public/support/report`
- `GET /api/v1/public/support/submissions/:code`

Public write endpoints share the `PUBLIC_WRITE_RATE_LIMIT_WINDOW_MS` and `PUBLIC_WRITE_RATE_LIMIT_MAX` limits.

Protected:

- `GET /api/v1/admin/auth/login`
- `GET /api/v1/admin/auth/callback`
- `GET /api/v1/admin/auth/session`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/bootstrap`
- `GET /api/v1/admin/system/bootstrap`
- `GET /api/v1/admin/audit`
- `GET /api/v1/admin/staff`
- `GET /api/v1/admin/submissions`
- `GET /api/v1/admin/submissions/:code`
- `POST /api/v1/admin/submissions/:code/claim`
- `POST /api/v1/admin/submissions/:code/notes`
- `POST /api/v1/admin/submissions/:code/decision`

Protected endpoints accept either a Discord OAuth admin session cookie or server-to-server bearer auth:

```http
Authorization: Bearer <API_SHARED_SECRET>
```

Server-to-server admin mutation routes may pass an optional actor header:

```http
X-SHD-Staff-Id: <discord-user-id-or-local-staff-name>
```

## Admin Portal Readiness

The SHD bot now returns admin-portal-shaped payloads for:

- overview metrics from `/api/v1/admin/bootstrap`
- audit events from `/api/v1/admin/audit`
- staff/access seed data from `/api/v1/admin/staff`
- review submissions from `/api/v1/admin/submissions`

The existing global admin portal still needs a frontend API-client split before it can consume both backends at once:

- Lifesteal workspace routes should continue to call the Lifesteal bot.
- SHD/General/Valorant/global SHD routes should call this SHD bot.
- Discord OAuth/session auth is implemented for the SHD bot. The existing admin portal still needs a frontend API-client split so Lifesteal routes keep using the Lifesteal bot while SHD/global routes use this SHD bot.

## Support Submission Payload

```json
{
  "workspace": "support",
  "formType": "support",
  "category": "general",
  "priority": "normal",
  "discordUsername": "name",
  "discordId": "123",
  "email": "person@example.com",
  "subject": "Need help",
  "message": "Long enough support message.",
  "metadata": {
    "source": "support-site"
  }
}
```

Valid `formType` values are `contact`, `application`, `appeal`, `report`, and `support`.

The form-specific endpoints apply defaults before validation:

- `/support/contact`: `workspace=support`, `formType=contact`, `category=general`
- `/support/application`: `workspace=general`, `formType=application`, `category=application`
- `/support/appeal`: `workspace=appeals`, `formType=appeal`, `category=appeal`, `priority=high`
- `/support/report`: `workspace=reports`, `formType=report`, `category=report`, `priority=high`
