# Important Project Remaining Work

This is the current non-anti-cheat unfinished work and priority list for the whole LS project.

## Current State

The project builds successfully across the main pieces:

- `LIFESTEAL` Gradle build
- `LIFESTEAL-CLIENT` Gradle build
- `admin-portal` build
- `reference-website` build
- `support-website` build
- Discord bot JavaScript syntax checks

The core Lifesteal stack is mostly at the stage of launch hardening, real-server validation, and product polish rather than basic compile-breaking unfinished code.

## Missing / Not Finished

1. **Real dedicated-server test pass**

   This is the biggest blocker. LAN testing is noted as unreliable, and final decisions need real server testing. Validate hearts, deaths, combat tags, combat logging, dragon egg, mace objectives, restricted items, Discord sync, UI timers, tab/bossbar/actionbar, and performance.

2. **Revival system polish**

   Admin `/revive` exists, but the planned player-facing revival beacon/chest-style GUI flow is unfinished. Also decide whether the revive beacon is consumed, transformed, or reusable.

3. **Rules/content mismatch cleanup**

   Public rules still mention or depend on systems whose exact behavior needs confirmation: revival beacon, heart withdrawals, Weakness potions in combat, Netherite wording, slow falling/Turtle Master/event potions, and fireworks/crossbow wording.

4. **Support/admin portal production completion**

   Lifesteal workflows are well connected, but General Support, Valorant, and status are still placeholders. The admin portal still needs the shared admin API direction finished across every workspace, plus live refresh/event streaming, pagination/server filtering, and the second SHD bot connection.

5. **Discord bot production hardening**

   The bot is feature-rich, but still needs a final hardening pass: staff copy/errors, permission review, rate limit tuning, route exposure review, CORS review, deployment hygiene, backup/restore, secret rotation, and possibly JSON-to-SQLite migration.

   Add a non-RCON Minecraft access sync before launch: the bot should expose a protected active/denied/banned access-list endpoint, and the Lifesteal Fabric mod should poll it over outbound HTTPS and apply whitelist/ban changes locally. This avoids public RCON and works when the bot and Minecraft server live on different machines.

6. **Public Lifesteal site completion**

   The live data path exists, but remaining polish includes world/map info, punishments/bans page, final legal/provider details, richer player profiles/overlays, better stale/offline states, and live event countdown language.

7. **Dragon egg edge cases**

   Validate placed egg location persistence when chunks unload, one-time popup/message behavior unless position changes, and the real 48-hour glow countdown on a real server.

8. **UI polish**

   Tune actionbar priority so timers and temporary notices do not overlap. HUD/tab/bossbar/scoreboard polish is still real-server dependent.

9. **Test coverage**

   There are essentially no automated test suites. Builds pass, but the project depends heavily on manual/integration testing right now.

10. **Release hygiene**

    `LIFESTEAL-CLIENT/` is currently untracked in git. If that client companion mod is intended to ship, it should be added deliberately; if it is experimental, keep it clearly marked.

## Priority List

1. Real dedicated-server validation pass.
2. Fix any gameplay bugs found during that server test pass.
3. Finalize revival beacon/player revival flow.
4. Reconcile public rules with actual implemented behavior.
5. Lock production deployment/env/backup/secret-rotation flow.
6. Harden Discord bot/admin API permissions, CORS, rate limits, and sensitive output.
7. Finish Lifesteal admin/support production workflows.
8. Finish public site content: world/map, punishments, legal/provider details.
9. Polish UI/actionbar/dragon egg presentation after server testing.
10. Add focused automated checks for the riskiest flows.
