# SHD Lifesteal Server Agent

Small outbound-only server helper for the Lifesteal host.

It posts a heartbeat to the Lifesteal bot/API:

```text
POST /api/v1/server/heartbeat
Authorization: Bearer API_SHARED_SECRET
```

The agent can also poll the backend action queue, but this is disabled by default and the current MVP does not execute remote actions.

## Setup

```bash
cd /opt/shd/agent/app
cp .env.example .env
npm start
```

No npm dependencies are required. Node.js 20+ is enough.

## What It Checks

- CPU, RAM, disk, temperature, uptime
- load average, local IPv4 addresses, and basic network presence
- `systemctl is-active` for the Minecraft service
- process presence through `pgrep -f`
- Minecraft status ping, including online/max players and version name when available
- latest log freshness, warning/error patterns, and crash markers
- server start/stop, join/leave counts, and Chunky progress lines from `latest.log`
- recent crash reports
- recursive backup age/count/size
- optional RCON TCP reachability only

RCON is not required and no remote actions are implemented.
`ACTIONS_ENABLED` should stay `false` for the beta launch.

## Backend Endpoints

Agent:

- `POST /api/v1/server/heartbeat`
- `POST /api/v1/server/log-event`
- `GET /api/v1/server/actions/pending?serverId=lifesteal-g17` disabled unless the backend explicitly enables actions
- `POST /api/v1/server/actions/:actionId/result`

Read-only status:

- `GET /api/v1/server/status`
- `GET /api/v1/server/status/:serverId`
- `GET /api/v1/server/history/:serverId`

Admin portal:

- `GET /api/v1/admin/lifesteal/server-status`

## Local Test

Send a fake healthy heartbeat:

```bash
npm run heartbeat:fake
```

## systemd

Use `systemd/shd-agent.service` as a template. It assumes:

- app path: `/opt/shd/agent/app`
- runtime user/group: `shd-agent`
- env file: `/opt/shd/agent/app/.env`

Adjust the paths in `.env` to the final G17 server layout before enabling the service.

## G17 Script Templates

Templates live in `scripts/`:

- `backup-lifesteal.sh` creates a timestamped full server backup and prunes old full backups.
- `deploy-mods.sh` pulls the mods repo, backs up active mods, and mirrors jar files into the active mods directory.
- `deploy-configs.sh` requires `CONFIG_DEPLOY_ALLOWLIST` and refuses blind config deploys.
- `healthcheck.sh` checks `systemd`, the Minecraft TCP port, and `latest.log`.

Copy these to `/opt/shd/lifesteal/scripts/`, review paths, then test them manually before any remote action execution is enabled.
