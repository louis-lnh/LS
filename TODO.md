# TODO

## Server Helper MVP

Completed foundation:

- Created `shd-agent/` as a small dependency-free Node.js service.
- Added `.env.example` for API, heartbeat, Minecraft, backup, and optional RCON probe settings.
- Added system metrics: CPU, RAM, disk, temperature where available, uptime.
- Added Minecraft service/process/port/log/crash checks without requiring RCON.
- Added optional RCON TCP probe only.
- Added backup detection for latest timestamp, age, count, and size.
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
7. Tune alert thresholds after the G17 is running:
   - stale heartbeat seconds
   - max CPU temperature
   - max RAM percentage
   - max disk percentage
   - max backup age
8. Test stale/offline alert by stopping the agent briefly.
9. Test Minecraft down alert by stopping only the Minecraft service.
10. Test backup stale detection with an old/missing backup folder.
11. Decide whether to keep RCON probe disabled or enable TCP-only probe.
12. Add real player online/max parsing later if simple TCP reachability is not enough.
13. Keep remote actions out until after launch:
    - no restart button
    - no shell commands
    - no web terminal
    - no required RCON.

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
4. Finish revival system polish:
   - decide final revive beacon behavior
   - player-facing revive flow or postpone clearly
   - consume/reuse/transform decision
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
    - 48-hour glow/status presentation.
11. UI polish in the mod:
    - actionbar priority
    - bossbar/tab consistency
    - timer overlap cleanup
    - temporary notice behavior.
12. Anti-cheat foundation cleanup:
    - make sure alerts are review-focused, not auto-ban
    - surface important evidence to staff
    - avoid noisy/low-confidence alerts.
    - add SHD client mod-list report on join
    - store latest reported client mod list per player UUID
    - alert staff for blocked/suspicious client mod IDs
    - alert or block when required SHD client integrity channel/report is missing
    - configure blocked/suspicious mod ID lists for minimaps, freecam, xray, Baritone, and known hacked clients
    - add DrexHD AntiXray to the server mod pack
    - configure DrexHD AntiXray for overworld and nether valuable ores
    - test AntiXray performance and visual behavior during the dedicated-server pass
    - keep ore-mining behavior alerts as backup evidence, not auto-ban logic
13. Update public rules/content after final behavior decisions:
    - remove "Lifesteal Season 1" framing across public/admin/player-facing surfaces
    - replace launch copy with "closed beta" / "join the beta" wording
    - update event countdown and schedule language away from Season 1 launch framing
    - revival beacon
    - heart withdrawals/crafted hearts
    - movement items
    - combat-banned items
    - potion wording
    - Netherite wording
    - fireworks/crossbow wording.
14. Release hygiene:
    - decide whether `LIFESTEAL-CLIENT/` ships
    - add it deliberately or mark experimental
    - final env examples
    - final deployment notes
    - final backup notes
    - final build artifacts/checklist.
