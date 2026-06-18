# SHD Discord Bot

Backend-first Discord bot for the SHD guild, websites, support flows, and future admin tooling.

## Current Scope

- Discord `/status` command.
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

## Scripts

```powershell
npm run check
npm run register
npm start
```

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
