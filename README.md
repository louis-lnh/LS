# LS Workspace

This workspace contains the SHD Lifesteal stack, related websites, Discord bots, integration test helpers, and project notes.

There is no single root build command for the whole workspace. Each app/mod is built or run from its own folder.

## Main Projects

### `LIFESTEAL/`

Authoritative server-side Fabric mod for the Lifesteal event.

It owns the actual Minecraft gameplay rules: heart state, eliminations, combat tagging, grace period, restricted items, dragon egg behavior, objective rules, admin commands, Discord gameplay-role sync, and the newer server anti-cheat foundation.

Useful files:

- `LIFESTEAL/README.md`: mod-specific setup and implemented feature list.
- `LIFESTEAL/docs/ARCHITECTURE.md`: gameplay architecture and module boundaries.
- `LIFESTEAL/docs/ANTI_CHEAT.md`: anti-cheat design and current implementation direction.

Build:

```powershell
cd LIFESTEAL
.\gradlew.bat build
```

### `LIFESTEAL-CLIENT/`

Client-only Fabric companion mod for Lifesteal visuals.

It packages the client representation/assets for the Lifesteal heart item. It intentionally does not own gameplay, commands, persistence, recipes, or server rules.

Build:

```powershell
cd LIFESTEAL-CLIENT
.\gradlew.bat build
```

### `discord-bot/`

Lifesteal-specific Discord bot and API backend.

It handles Discord/Minecraft account linking, join tickets, application review, appeals, risk checks, staff commands, public Lifesteal API routes, gameplay role sync from the Fabric mod, stream overlay data, and optional Minecraft RCON whitelist/kick/ban actions.

Run:

```powershell
cd discord-bot
npm install
npm run register
npm start
```

### `shd-agent/`

Lightweight outbound-only server helper intended to run next to the Lifesteal Minecraft server on the G17.

It collects basic host/service/log/backup status and posts heartbeats to the Lifesteal bot API. It does not expose a local web API, require RCON, run shell commands from the portal, or perform remote actions.

Run:

```powershell
cd shd-agent
copy .env.example .env
npm start
```

### `SHD/discord-bot/`

General SHD Discord bot and backend.

This is separate from the Lifesteal-specific bot. It is meant for broader SHD guild support, global admin tooling, generic support submissions, audit events, staff access, and future non-Lifesteal workspaces.

Run:

```powershell
cd SHD\discord-bot
npm install
npm run register
npm start
```

### `admin-portal/`

React/Vite admin portal.

This is the staff-facing web UI for review queues, players, events, staff chat, applications, appeals, reports, support items, staff access, global overview, and workspace navigation. It currently connects to bot/admin APIs and is intended to become the central staff operations surface.

Run:

```powershell
cd admin-portal
npm install
npm run dev
```

Build:

```powershell
npm run build
```

### `reference-website/`

Public Lifesteal reference website.

This is the public-facing Lifesteal site for pages such as landing, rules, players, events, world info, signup, and punishments. It can read live public API data and falls back to mock data when the API is unavailable.

Run:

```powershell
cd reference-website
npm install
npm run dev
```

### `support-website/`

Public support/signup website.

This site supports public Lifesteal signup and support flows, including rules acknowledgement and support form submission through the bot API. It shares the Vite/React style of the other web frontends.

Run:

```powershell
cd support-website
npm install
npm run dev
```

### `integration-test/`

Local integration staging area.

This folder contains helper scripts and notes for staging built mod jars into a test setup. It is mainly for validating the Lifesteal mod with the planned `shd-core` and `shd-ui-client` UI pipeline.

Useful scripts:

- `stage-mods.ps1`
- `update-lifesteal-jar.ps1`

## Notes And Planning

### `.notes/`

Current project notes grouped by area.

Important folders include:

- `.notes/Lifesteal Mod/`: Lifesteal mod progress, pending work, and anti-cheat coverage notes.
- `.notes/Discord Bot/`: bot implementation notes.
- `.notes/Lifesteal Site/`: public site notes.
- `.notes/Support Site/`: support site notes.
- `.notes/_archive/`: older migrated notes.

### `IMPORTANT_PROJECT_REMAINING_WORK.md`

Top-level remaining-work list for the overall LS project.

This file summarizes the main non-anti-cheat blockers and launch-hardening tasks, such as real dedicated-server validation, revival polish, rules cleanup, portal/API hardening, public site polish, and release hygiene.

### `.checklist/`

Small local checklist artifact folder.

Currently contains an HTML checklist file used for local project tracking.

### `.archive/`

Archived or older project material.

Use this as reference only unless intentionally restoring older work.

### `.vscode/`

Editor configuration for the workspace.

## Root Files

### `.gitignore`

Git ignore rules for generated files, local config, build output, and secrets.

### `README.md`

This file. It is the high-level map of the workspace.

## Current Shape

The workspace is best understood as several connected but independently built parts:

- Minecraft gameplay lives in `LIFESTEAL/`.
- Client-only Minecraft visuals live in `LIFESTEAL-CLIENT/`.
- Lifesteal Discord/API operations live in `discord-bot/`.
- General SHD Discord/API operations live in `SHD/discord-bot/`.
- Staff UI lives in `admin-portal/`.
- Public Lifesteal pages live in `reference-website/`.
- Public support/signup pages live in `support-website/`.
- Local mod staging and manual validation helpers live in `integration-test/`.
- Planning and historical notes live in `.notes/`, `.archive/`, and `IMPORTANT_PROJECT_REMAINING_WORK.md`.
