# TODO

## Server Helper MVP

Completed foundation:

- Created `shd-agent/` as a small dependency-free Node.js service.
- Added `.env.example` for API, heartbeat, Minecraft, backup, and optional RCON probe settings.
- Added system metrics: CPU, RAM, disk, temperature where available, uptime.
- Added Minecraft service/process/port/log/crash checks without requiring RCON.
- Added optional RCON TCP probe only.
- Added backup detection for latest timestamp, age, count, and size.
- Expanded the heartbeat payload with load averages, local IPs, disk/RAM percentages, service state, log error summary, backup stale state, and agent mode.
- Updated the bot heartbeat receiver to retain the expanded monitoring payload while preserving existing health alerts.
- Aligned the agent `.env.example` and `systemd` template with the planned `/opt/shd/agent/app` and `/opt/shd/lifesteal/server` G17 layout.
- Added server-specific status/history API reads for the helper data.
- Added active/resolved Discord alert state for server-helper issues.
- Added a read-only admin API endpoint for detailed Lifesteal server status.
- Added a read-only Lifesteal admin portal G17 health card.
- Added protected server log-event ingest endpoint for future normalized evidence/audit events.
- Added disabled-by-default safe action queue scaffolding:
  - agent poll endpoint
  - agent result endpoint
  - agent poller
  - no real restart/backup/deploy/RCON execution yet.
- Added G17 script templates for backup, mods deploy, config deploy, healthcheck, and narrow sudoers.
- Added Minecraft status ping parsing for online/max players and server version.
- Added log summary fields for server start/stop, join/leave counts, and Chunky progress/completion.
- Added bot endpoints:
  - `POST /api/v1/server/heartbeat`
  - `GET /api/v1/server/status`
- Added latest status, short history, and alert state storage in bot JSON data.
- Added Discord alert cooldowns for stale heartbeat, Minecraft down/crash, high temp/RAM/disk, stale backup, and repeated "Can't keep up" warnings.
- Added lightweight admin portal service-map row for Lifesteal server health.
- Added Ubuntu `systemd` service template and setup docs.
- Added local fake heartbeat script.
- Kept remote actions out of the MVP.

Remaining server-helper work:

1. Configure real production `.env` values for the G17.
2. Confirm final Minecraft service name, server path, log path, crash-report path, and backup path on Ubuntu.
3. Install the agent on the G17 and enable the `systemd` service.
4. Send a fake heartbeat to production/staging API before deploying the real agent.
5. Verify live heartbeat appears in the admin portal.
6. Verify Discord alert routing uses the right staff/Minecraft log channel.
7. Validate script templates on Ubuntu with `bash -n` and manual dry runs before using them:
   - backup script
   - mods deploy script
   - config deploy script
   - healthcheck script
8. Tune alert thresholds after the G17 is running:
   - stale heartbeat seconds
   - max CPU temperature
   - max RAM percentage
   - max disk percentage
   - max backup age
9. Test stale/offline alert by stopping the agent briefly.
10. Test Minecraft down alert by stopping only the Minecraft service.
11. Test backup stale detection with an old/missing backup folder.
12. Decide whether to keep RCON probe disabled or enable TCP-only probe.
13. Keep remote actions out until after launch:
    - no restart button
    - no shell commands
    - no web terminal
    - no required RCON.
14. After launch, only if needed, implement real allowlisted actions behind auth, audit, cooldowns, locks, sudoers, and manual backup/restore validation.

## Lifesteal Project Remaining Work

This excludes the full real dedicated-server validation pass, but keeps targeted Minecraft server tests that are still open.

1. Finish the server helper MVP above.
2. Finish launch-ready Discord alerts for server health and Minecraft crash/status problems.
3. Testing:
   - test weakness potion behavior
   - test tipped arrow behavior
   - test strength potion limits
   - test totem/crystal/anchor behavior
   - test netherite sword/axe rules
   - test Protection/Sharpness caps
   - test full firework rocket ban
   - test Lunge removal from existing spears and generated outputs
   - test Elytra equip blocking during combat lock
   - test ender pearl cooldown/blocking behavior
   - test Riptide trident behavior during combat lock
   - test slow falling potion rules
   - test Turtle Master/event potion rules
   - test tagged vanilla beacon revival workflow
   - test tab/playerlist beta countdown and beta version footer
4. Finish revival system polish:
   - tagged vanilla beacon behavior is implemented for beta
   - recipe output uses server-owned custom data, custom name, and glint
   - revival menu consumes one tagged beacon on successful revive
5. Finish Discord bot production hardening:
   - full VPS reinstall/rebuild for `verify.shd-esports.com`
   - restore DNS for `verify.shd-esports.com` to the VPS
   - install Node.js/runtime, reverse proxy, TLS, firewall, and process manager/service
   - redeploy Lifesteal Discord bot/API with production `.env`
   - verify `/health`, admin OAuth callback, gameplay sync, server helper heartbeat, and overlay endpoints
   - permission review
   - route exposure review
   - CORS review
   - rate limit tuning
   - staff-facing error/copy cleanup
   - backup/restore flow
   - secret rotation plan.
6. Add non-RCON access sync before launch if still desired:
   - protected active/denied/banned endpoint
   - Fabric mod polls or syncs access state over HTTPS
   - avoid public RCON dependency.
7. Finish admin portal Lifesteal workflows:
   - server status card
   - review queues polish
   - player access/status polish
   - live refresh or manual refresh consistency
   - better stale/offline states.
8. Finish public Lifesteal site polish:
   - world/map info
   - punishments/bans page
   - final provider/legal/server details
   - richer player profile/status states
   - event countdown wording.
9. Finish support/signup polish:
    - application copy
    - support form edge cases
    - rules acknowledgement flow
    - user-facing errors.
10. Dragon egg polish:
    - placed egg persistence edge cases
    - item frame behavior
    - popup/message behavior
    - 12-hour dragon egg glow/status presentation.
11. UI polish in the mod:
    - actionbar priority
    - tab/playerlist beta countdown and beta version footer are implemented
    - bossbar/tab consistency
    - timer overlap cleanup
    - temporary notice behavior.
12. Anti-cheat foundation cleanup:
    - make sure alerts are review-focused, not auto-ban
    - surface important evidence to staff
    - avoid noisy/low-confidence alerts.
    - SHD client mod-list report on join is implemented
    - latest reported client mod list is stored per player UUID
    - blocked/suspicious client mod ID alerts are implemented as audit-only detections
    - missing required SHD client integrity channel/report alerts are implemented
    - review and tune blocked/suspicious mod ID lists for minimaps, freecam, xray, Baritone, and known hacked clients
    - add DrexHD AntiXray to the server mod pack
    - configure DrexHD AntiXray for overworld and nether valuable ores
    - test AntiXray performance and visual behavior during the dedicated-server pass
    - keep ore-mining behavior alerts as backup evidence, not auto-ban logic
13. Update public rules/content after final behavior decisions:
    - public/support rules updated for closed beta wording
    - public/support rules updated for tagged vanilla Revival Beacon
    - public/support rules updated for `/withdraw`, crafted hearts, and heart storage
    - public/support rules updated for movement restrictions, Riptide-only tridents, Elytra, and combat pearls
    - public/support rules updated for banned items, Firework Rockets, Netherite, Spears, Lunge, potions, Protection, and Sharpness
    - final rules pass after dedicated-server validation if tests reveal behavior changes.
14. Release hygiene:
    - package `LIFESTEAL-CLIENT/` for closed beta
    - final env examples
    - final deployment notes
    - final backup notes
    - final build artifacts/checklist.

---
1. Client Download Page (optional - this would be either on the website or in discord)
    - the page should get another page or link to download a full modpack for the beta
         - players would have the option to choose between just a zip for all mods or a modrinth/curseforge zip folder
