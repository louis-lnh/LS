# SHD Lifesteal Architecture

## Mod Role

`shd-lifesteal` is the authoritative gameplay-rules mod. It should not depend on client automation, rendering, or UI presentation mods to decide gameplay outcomes.

Expected ecosystem boundaries:

- `shd-core`: shared systems only
- `shd-lifesteal`: authoritative gameplay rules
- `shd-ui-client`: client-side rendering only
- `shd-pvp`: mostly client automation

Anti-cheat/security remains a future separate module. The canonical split is documented in `docs/ANTI_CHEAT.md`: reusable `shd-anticheat-core` plus a Lifesteal-specific integrity add-on.

## Canonical Gameplay Decisions

- Starting hearts: 10 hearts / vanilla health
- Max hearts: 20 hearts / 40 HP
- A player who dies loses 1 heart after death resolution
- A player who dies while already at 1 heart is eliminated
- The most recent player attacker receives kill credit during combat tagging
- Heart items always drop at the victim death location
- During grace period: no PvP, no combat tagging, no lifesteal, no heart loss, no eliminations, no heart drops
- Heart items may exist only in player inventory, as world drops, or in item frames
- Dragon egg may exist only in player inventory, as a world drop, in item frames, or placed as a block
- A player carrying the dragon egg gets glowing for as long as they carry it
- Season reset is external server work; this mod only clears its own persisted state

When notes disagree, `HH-overall.md` is priority 1.

## Core/UI Bridge

The `com.shd.lifesteal.api` package is intentionally small and stable. Other SHD mods should integrate through these interfaces rather than reaching into implementation packages.

The preferred UI path is:

- `shd-lifesteal` owns gameplay state and emits UI-relevant events
- `shd-core` implements the server/client bridge and shared networking
- `shd-ui-client` depends on `shd-core` and renders the HUD/screens from synced core state

This keeps Lifesteal independent from client rendering while still allowing the core mod to be present on both dedicated servers and clients. Lifesteal should talk only to the core bridge API; the UI client should not call Lifesteal implementation classes directly.

Until `shd-core` exists in this workspace, Lifesteal exposes a temporary Fabric entrypoint named:

```json
{
  "entrypoints": {
    "shd-lifesteal-ui": [
      "com.example.MyLifestealUiBridge"
    ]
  }
}
```

That class should implement `com.shd.lifesteal.api.ui.LifestealUiBridge`.

Once `shd-core` is available, Core should provide that entrypoint, translate Lifesteal events into stable core UI packets/state, and forward only render-safe data to `shd-ui-client`.

## Persistence

The intended production store is SQLite. The scaffold keeps storage behind `LifestealRepository` so gameplay services do not care whether data comes from SQLite, JSON, or a test double.

Current SQLite path:

- `config/shd-lifesteal/lifesteal.sqlite`

The player record is created lazily on first join or first admin status/change command.

Admin commands resolve players from the online player list first, then from the server root `whitelist.json`. Offline whitelisted players can have SQLite state changed immediately; max-health changes apply when they next join.

## Death Pipeline

The first death layer is implemented:

- Grace-protected deaths increment death stats but do not change hearts or elimination state
- Non-grace deaths subtract one heart
- Death at 1 heart marks the player eliminated while keeping stored hearts at 1
- Max health is reapplied after respawn
- All online players hear the wither-spawn sound on any player death

Killer rewards, combat-tag attribution, heart item drops, and immediate eliminated-player kick/soft-ban enforcement are intentionally handled in later layers.

## Combat Tagging

Current combat layer:

- PvP damage outside grace tags both players
- Tag duration is 30 seconds
- Additional PvP hits refresh the timer
- The most recent player attacker is stored for each victim
- Expired tags are cleared lazily when queried
- `/lifesteal status <player>` includes active combat tag info

Combat logging and death-credit transfer will reuse this service in the next gameplay layers.

## Combat Logging

Current combat logout layer:

- Disconnecting while combat tagged triggers combat logout punishment
- The player's inventory is dropped immediately
- The same death-resolution service handles victim heart loss, killer reward, heart item drop, and elimination
- The combat tag is cleared as part of death resolution
- V1 does not spawn a logout body/NPC

## Grace Period

Current grace layer:

- `/lifesteal grace status` reports active/paused state and remaining time
- `/lifesteal grace start` starts the default 60-minute grace period
- `/lifesteal grace end` immediately ends grace
- `/lifesteal grace pause` freezes the remaining grace time
- `/lifesteal grace resume` resumes from the paused remaining time
- Player-vs-player damage is cancelled while grace is active or paused
- Combat tagging and lifesteal death rules already check the same grace state

## Disabled Features

Current disabled-feature layer:

- End crystals are blocked
- Respawn anchors are blocked
- Totems of Undying are removed from player inventories so they cannot trigger
- Tipped arrows are removed from player inventories
- Debuff potions are blocked/removed
- Normal drinkable Weakness potions are allowed for curing zombie villagers; Splash, Lingering, and other non-normal Weakness variants are blocked/removed
- Strength II or higher is blocked/removed
- All firework rockets are blocked/removed
- PvP combat tagging applies item cooldowns to Elytras, ender pearls, and tridents
- Ender pearls are blocked while combat tagged as a server-side backstop
- Riptide tridents are blocked while combat tagged as a server-side backstop; non-Riptide tridents are not blanket-banned
- Elytra equip/use and TNT minecarts are blocked/removed while combat tagged
- Netherite swords, axes, spears, and armor are removed
- Protection above 3 is clamped down to 3 on carried items/books
- Sharpness above 4 is clamped down to 4 on carried items/books
- Lunge is removed from carried items/books
- Crafting/anvil/smithing result slots refuse restricted outputs before the player can take them
- Enchanting table rolls are capped so Protection IV becomes Protection III and Sharpness V becomes Sharpness IV
- New mace crafting/smithing outputs are refused once 2 known maces already exist

The implementation combines use callbacks, inventory sanitizing, and focused server-side screen-handler mixins. The mace cap counts online player inventories, loaded dropped items, loaded item frames, and loaded block inventories near players. It does not inspect unloaded chunk storage until those chunks are loaded near players.

## Restricted Storage

Current restricted-storage layer:

- Heart items may remain in player inventories, as dropped items, or in item frames
- Dragon eggs may remain in player inventories, as dropped items, in item frames, or placed as a block
- Heart items and dragon eggs found in loaded vanilla block inventories near players are ejected into the world
- Heart items and dragon eggs found inside bundles in loaded vanilla storage are removed from the bundle and ejected
- Players carrying a dragon egg receive a refreshed glowing effect

This first implementation uses server tick sanitizing around loaded chunks near players instead of custom screen-handler mixins. If stricter instant click prevention is needed later, add a focused screen/slot mixin on top of the same policy.

## Heart Transfer

Current transfer layer:

- Death resolution asks combat tagging for the victim's most recent attacker
- Victim loses one heart outside grace
- Credited killer gains one heart if below 20 hearts
- Killer max health is applied immediately when the killer is online
- Killer kill stats increment when credited
- If no valid killer exists, a heart item drops at the victim death location
- If the credited killer is already at 20 hearts, a heart item drops at the victim death location

## Heart Item

Current item layer:

- `shd-lifesteal:heart` is registered as a custom item
- Max stack size is 1
- Right-clicking consumes one item and adds one heart if the player is below max
- Creative players do not consume the stack
- Death-transfer drop cases spawn the item at the victim death location
- The current item model is temporary and points at the vanilla nether star texture

## Elimination Enforcement

Current enforcement:

- Death at 1 heart marks the player eliminated and disconnects them
- `/lifesteal player eliminate <player>` marks a player eliminated and disconnects them if online
- Eliminated players are disconnected immediately during the Fabric play-join and after-respawn events
- `/lifesteal player revive <player>` clears eliminated state and restores 3 hearts
- `/lifesteal player reset <player>` clears eliminated state and restores 10 starting hearts

The join check happens as soon as Fabric exposes the joined server player without mixins. If stricter pre-play login blocking is needed later, add a focused login/profile mixin instead of weakening the gameplay service.

## V1 Focus

V1 should prioritize the stable gameplay loop:

- player data
- heart application
- death transfer
- combat tagging
- combat logging
- eliminations
- grace period
- restricted heart/dragon egg storage
- dragon egg glowing holder effect
- admin commands

The tagged vanilla Beacon revival flow, persistent mace tracking, End lockout, and advanced events are layered onto this architecture.
