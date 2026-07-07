# TODO

## Server Helper MVP

1. Create `shd-agent/` as a small Node.js service.
2. Add `.env.example` for:
   - `SERVER_ID=lifesteal-g17`
   - `API_URL=https://verify.shd-esports.com`
   - `API_SHARED_SECRET=...`
   - `HEARTBEAT_INTERVAL_SECONDS=15`
   - Minecraft service name, log path, backup path.
3. Collect system metrics:
   - CPU usage
   - RAM used/total
   - Disk used/total
   - CPU temperature where available
   - uptime
4. Check Minecraft service state:
   - `systemctl is-active lifesteal`
   - process exists
   - latest log updated recently
5. Add optional Minecraft details without depending on RCON:
   - online/offline
   - players online/max if query/ping works
   - latest crash/log error summary
   - "Can't keep up" warning count
6. Add optional RCON probe only:
   - `rconAvailable`
   - `rconError`
   - no required commands yet
7. Add backup detection:
   - last backup timestamp
   - backup age
   - backup folder size/count
8. Add VPS API endpoints in `discord-bot`:
   - `POST /api/v1/server/heartbeat`
   - `GET /api/v1/server/status`
9. Persist latest status and short history in bot JSON storage.
10. Add Discord alerts:
    - server heartbeat stale/offline
    - Minecraft service down
    - high CPU temp
    - high RAM/disk
    - backup stale
    - repeated "Can't keep up"
    - crash detected
11. Add alert cooldown/state so it does not spam.
12. Add a lightweight admin portal card:
    - status
    - last heartbeat
    - service state
    - players
    - CPU/RAM/disk/temp
    - last backup
    - latest warning/error
13. Add Ubuntu `systemd` service file/instructions for the agent.
14. Add a local fake heartbeat script for testing the portal/API before the G17 exists.
15. Keep remote actions out of MVP:
    - no restart button
    - no shell commands
    - no web terminal
    - no required RCON.

## Lifesteal Project Remaining Work

This excludes the real dedicated-server validation pass.

1. Finish the server helper MVP above.
2. Finish launch-ready Discord alerts for server health and Minecraft crash/status problems.
3. Rework combat-banned items:
   - confirm final banned/restricted item list
   - clean up weakness potion behavior
   - clean up tipped arrow behavior
   - confirm strength potion limits
   - confirm explosive firework/crossbow wording and enforcement
   - confirm totem/crystal/anchor behavior
   - confirm netherite sword/axe rules
   - confirm Protection/Sharpness caps
4. Rework movement items generally:
   - Elytra behavior inside and outside combat
   - ender pearl cooldown/blocking behavior
   - Riptide trident behavior
   - slow falling potion rules
   - Turtle Master/event potion rules
   - any grace-period exceptions
   - make rules, mod behavior, and public site text match.
5. Finish revival system polish:
   - decide final revive beacon behavior
   - player-facing revive flow or postpone clearly
   - consume/reuse/transform decision
   - update commands/rules/site accordingly.
6. Clean up public rules/content mismatches:
   - revival beacon
   - heart withdrawals/crafted hearts
   - movement items
   - combat-banned items
   - potion wording
   - Netherite wording
   - fireworks/crossbow wording.
7. Finish Discord bot production hardening:
   - permission review
   - route exposure review
   - CORS review
   - rate limit tuning
   - staff-facing error/copy cleanup
   - backup/restore flow
   - secret rotation plan.
8. Add non-RCON access sync before launch if still desired:
   - protected active/denied/banned endpoint
   - Fabric mod polls or syncs access state over HTTPS
   - avoid public RCON dependency.
9. Finish admin portal Lifesteal workflows:
   - server status card
   - review queues polish
   - player access/status polish
   - live refresh or manual refresh consistency
   - better stale/offline states.
10. Finish public Lifesteal site polish:
    - world/map info
    - punishments/bans page
    - final provider/legal/server details
    - richer player profile/status states
    - event countdown wording.
11. Finish support/signup polish:
    - application copy
    - support form edge cases
    - rules acknowledgement flow
    - user-facing errors.
12. Dragon egg polish:
    - placed egg persistence edge cases
    - item frame behavior
    - popup/message behavior
    - 48-hour glow/status presentation.
13. UI polish in the mod:
    - actionbar priority
    - bossbar/tab consistency
    - timer overlap cleanup
    - temporary notice behavior.
14. Anti-cheat foundation cleanup:
    - make sure alerts are review-focused, not auto-ban
    - surface important evidence to staff
    - avoid noisy/low-confidence alerts.
15. Release hygiene:
    - decide whether `LIFESTEAL-CLIENT/` ships
    - add it deliberately or mark experimental
    - final env examples
    - final deployment notes
    - final backup notes
    - final build artifacts/checklist.
