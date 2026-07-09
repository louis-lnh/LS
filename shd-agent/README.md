# SHD Lifesteal Server Agent

Small outbound-only server helper for the Lifesteal host.

It posts a heartbeat to the Lifesteal bot/API:

```text
POST /api/v1/server/heartbeat
Authorization: Bearer API_SHARED_SECRET
```

## Setup

```bash
cd /opt/shd-agent
cp .env.example .env
npm start
```

No npm dependencies are required. Node.js 20+ is enough.

## What It Checks

- CPU, RAM, disk, temperature, uptime
- `systemctl is-active` for the Minecraft service
- process presence through `pgrep -f`
- Minecraft TCP port reachability
- latest log freshness and warning patterns
- recent crash reports
- backup age/count/size
- optional RCON TCP reachability only

RCON is not required and no remote actions are implemented.

## Local Test

Send a fake healthy heartbeat:

```bash
npm run heartbeat:fake
```

## systemd

Use `systemd/shd-agent.service` as a template. Adjust `WorkingDirectory`, `User`, and paths in `.env`.
