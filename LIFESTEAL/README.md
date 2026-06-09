# SHD Lifesteal

Server-side Fabric Lifesteal mod for the SHD mod ecosystem.

## Current Scope

This repository is scaffolded for `shd-lifesteal`, the authoritative gameplay-rules mod. It owns heart state, eliminations, combat tagging, grace-period rules, restricted-item handling, and admin-facing control surfaces.

The future library/core mod can integrate through the API package and the custom UI bridge entrypoint without taking ownership of gameplay state.

## Build

Use the project-local Gradle wrapper:

```powershell
.\gradlew.bat build
```

The current build bundles Xerial SQLite JDBC. Fabric Loom may print a warning that Xerial's `3.53.0.0` version is not valid semver while generating nested metadata; the build still succeeds.

## Implemented Foundation

- SQLite player store at `config/shd-lifesteal/lifesteal.sqlite`
- Player row creation on join with 10 starting hearts
- Stored hearts applied to the vanilla max-health attribute
- Admin command: `/lifesteal status [player]`
- Admin commands: `/lifesteal hearts set|add|remove <player> <amount>`
- Admin player arguments resolve online players first, then offline players from server `whitelist.json`
- Death handling subtracts one heart outside grace, eliminates players who die at 1 heart, and plays the global wither-spawn sound
- Eliminated players are kicked on elimination and rejected immediately on join unless they are server operators
- Admin commands: `/lifesteal player eliminate|revive|reset <player>`
- PvP damage outside grace combat-tags both players for 30 seconds and tracks the most recent attacker
- `/lifesteal status <player>` shows active combat tag state when present
- Death resolution credits the combat tag's most recent attacker, awards +1 heart below max, and records kill stats
- Custom heart item `shd-lifesteal:heart` is registered, drops from transfer overflow/no-killer cases, and grants +1 heart on right-click up to max
- Crafted hearts use an expensive Nether/End-material recipe, are tagged as crafted, and can only be crafted/used below 10 hearts outside grace
- Temporary heart item model uses the vanilla nether star texture until the Blockbench model/texture is added
- Combat logging while tagged drops the player's inventory and resolves the same heart transfer/elimination path as death
- Grace commands support status/start/end/pause/resume, and grace blocks PvP damage
- Disabled-feature enforcement blocks crystals, anchors, totems, tipped arrows, restricted potions, oversized explosive fireworks, combat pearls/elytra/TNT minecarts, combat Riptide tridents, netherite sword/axe, Protection above 3, and Sharpness above 4
- Mace limiting issues a hidden tracking id to every crafted/discovered mace, persists last-known locations in `config/shd-lifesteal/maces.json`, blocks player/workbench/autocrafter mace crafts once two tracked maces exist, and writes `mace-audit.log` entries for blocked or suspicious maces
- Heart items and dragon eggs are ejected from loaded vanilla storage/bundles near players; dragon egg carriers glow
- Dragon egg glow uses a persisted 48-hour holder timer and keeps counting while the egg is moved on the inventory cursor
- Placed dragon eggs and dragon eggs in item frames emit a server-particle vertical marker from Y -60 to Y 312
- Optional Discord gameplay-role sync posts exact heart count, eliminated state, dragon egg holder, and mace holder snapshots to the Discord bot API

## Discord Gameplay Role Sync

The sync is disabled by default. To enable it, set these environment variables before starting the Minecraft server:

```env
LIFESTEAL_DISCORD_ROLE_SYNC_ENDPOINT=http://localhost:3000/api/v1/gameplay/roles/sync
LIFESTEAL_DISCORD_API_SHARED_SECRET=replace_with_the_bot_API_SHARED_SECRET
LIFESTEAL_DISCORD_ROLE_SYNC_INTERVAL_SECONDS=60
LIFESTEAL_DRAGON_EGG_GLOW_HOURS=48
```

The shared secret must match the Discord bot's `API_SHARED_SECRET`. If the bot is offline or rejects the request, gameplay continues and the mod logs a warning.

The dragon egg marker is a server-particle approximation of a beacon beam. A true solid beacon-style render can be upgraded later in the client/UI mod.

## Heart Item Assets

Replace the temporary model at:

- `src/main/resources/assets/shd-lifesteal/models/item/heart.json`

Add the final texture at:

- `src/main/resources/assets/shd-lifesteal/textures/item/heart.png`

## Planned Modules

- `api`: public contracts for other SHD mods
- `impl.heart`: heart state and death transfer rules
- `impl.combat`: combat tagging and combat logout handling
- `impl.command`: admin command registration boundary
- `impl.dragon`: dragon egg objective rules
- `impl.elimination`: soft-ban/elimination flow
- `impl.grace`: server grace-period state
- `impl.item`: heart item registration and behavior boundary
- `impl.storage`: restricted storage rules for hearts and the dragon egg
- `impl.ui`: bridge loader for later UI/library integration
- `impl.data`: persistence boundary, intended for SQLite

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design map.
