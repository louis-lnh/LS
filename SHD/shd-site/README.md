# SHD Site

Next.js website and lightweight SQLite backend for the SHD public site. The Discord bot controls roster, matches, clips, announcements, VODs, and Premier record data through protected internal API routes.

## Local Setup

```powershell
cd B:\LS\SHD\shd-site
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:3000`.

Required local env:

```env
SHD_SITE_INTERNAL_TOKEN=use-the-same-secret-as-the-bot
SHD_SITE_DB_FILE=./data/shd-site.sqlite
```

The SQLite database seeds itself from `src/lib/site-data.ts` on first run.

## Production/VPS

Install and build:

```bash
cd /var/www/shd-site
npm ci
npm run build
```

Production env:

```env
NODE_ENV=production
PORT=3000
SHD_SITE_INTERNAL_TOKEN=renew-this-shared-secret
SHD_SITE_DB_FILE=/var/lib/shd-site/shd-site.sqlite
```

Start:

```bash
npm run start -- -p 3000
```

Example `systemd` service:

```ini
[Unit]
Description=SHD Site
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/shd-site
EnvironmentFile=/var/www/shd-site/.env
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Example Nginx site:

```nginx
server {
    listen 80;
    server_name shd-esports.com www.shd-esports.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

The Discord bot should point at the public site backend:

```env
SHD_SITE_INTERNAL_API_BASE_URL=https://shd-esports.com/api/internal/bot
SHD_SITE_INTERNAL_TOKEN=renew-this-shared-secret
```

`SHD_SITE_INTERNAL_API_BASE_URL=https://shd-esports.com` also works with the current bot because it normalizes the internal API path automatically.

## Health Checks

- `GET /api/health`: public service/storage health.
- `GET /api/internal/bot/status`: protected bot connectivity check.

Example protected check:

```bash
curl -H "Authorization: Bearer $SHD_SITE_INTERNAL_TOKEN" \
  https://shd-esports.com/api/internal/bot/status
```

## Website Control API

Protected routes require:

```http
Authorization: Bearer <SHD_SITE_INTERNAL_TOKEN>
```

Implemented routes:

- `GET /api/internal/bot/status`
- `GET /api/internal/bot/content?type=summary|roster|matches|clips|announcements|audit`
- `POST /api/internal/bot/announcements`
- `PATCH /api/internal/bot/announcements/:id`
- `DELETE /api/internal/bot/announcements/:id`
- `POST /api/internal/bot/roster`
- `DELETE /api/internal/bot/roster/:id`
- `POST /api/internal/bot/matches`
- `PATCH /api/internal/bot/matches/:id`
- `DELETE /api/internal/bot/matches/:id`
- `POST /api/internal/bot/matches/:id/result`
- `POST /api/internal/bot/clips`
- `PATCH /api/internal/bot/clips/:id`
- `DELETE /api/internal/bot/clips/:id`
- `POST /api/internal/bot/vods`
- `POST /api/internal/bot/premier-record`

Public read routes:

- `GET /api/public/bootstrap`
- `GET /api/public/roster`
- `GET /api/public/matches`
- `GET /api/public/clips`
- `GET /api/public/stats`
- `GET /api/public/announcements`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
