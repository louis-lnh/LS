# SHD Anti-Cheat Design

Canonical design direction for the SHD anti-cheat work.

The existing coverage notes live in:

- `.notes/Lifesteal Mod/anti cheat/anticheatcoverage.md`
- `.notes/Lifesteal Mod/anti cheat/anticheatadditional.md`

Those files are broad requirement dumps. This document is the implementation-facing plan: how to split the anti-cheat so the normal server anti-cheat can be reused in future non-Lifesteal events, while Lifesteal-specific integrity rules remain isolated.

## Decision

Build anti-cheat as two cooperating modules:

1. `shd-anticheat-core`
   - reusable server-side anti-cheat and evidence system
   - no Lifesteal assumptions
   - usable for future SHD Minecraft events

2. `shd-lifesteal-anticheat`
   - Lifesteal and Season 1 integrity add-on
   - depends on `shd-anticheat-core`
   - integrates with `shd-lifesteal` APIs and event rules

This keeps the boring, reusable cheating checks separate from the special Season 1 logic around hearts, maces, dragon egg tracking, grace period, elimination, revival, and public API consistency.

## Why Split It

The normal anti-cheat should care about common Minecraft cheating:

- movement
- combat
- inventory anomalies
- impossible item state
- client/mod metadata if available
- alt/account/session risk if available
- staff audit context
- evidence logging and alert routing

The Lifesteal add-on should care about competitive state that only exists in this season:

- heart economy
- elimination and revival state
- custom mace identity and tracking
- dragon egg objective tracking
- grace period enforcement
- combat tag integrity
- mobility-assisted mace kills
- restricted Lifesteal items
- Discord/API/website state mismatches
- event reward and objective audit trails

If those are mixed together, future events either inherit Lifesteal baggage or need a messy fork. The split gives us a reusable foundation and a focused event module.

## Module Boundaries

### `shd-anticheat-core`

Owns:

- common alert model
- evidence snapshots
- severity levels
- player violation history
- check scheduling
- staff/admin context
- generic movement checks
- generic combat checks
- generic inventory/item checks
- generic restricted-item policy hooks
- generic command/audit hooks
- alert sinks for log, Discord bridge, and admin UI

Must not import `shd-lifesteal` implementation packages.

Can expose small APIs like:

- `AntiCheatService`
- `EvidenceSnapshot`
- `AntiCheatAlert`
- `AntiCheatSeverity`
- `CheckResult`
- `PlayerTrustContext`
- `RestrictedItemRule`
- `GameplayPhaseProvider`

### `shd-lifesteal-anticheat`

Owns:

- Lifesteal-specific check registration
- Lifesteal evidence enrichers
- heart state consistency checks
- elimination/revival checks
- custom mace checks
- dragon egg/objective checks
- grace/combat-tag checks
- mobility-assisted kill review checks
- event-state consistency checks
- public snapshot consistency checks

May depend on stable `shd-lifesteal.api` interfaces. It should avoid reaching into Lifesteal implementation internals unless we intentionally add a small API for missing state.

Current source:

- `com.shd.lifesteal.impl.anticheat.lifesteal.LifestealAntiCheatModule`
- `com.shd.lifesteal.impl.anticheat.lifesteal.LifestealAntiCheatCheckDefinition`
- `com.shd.lifesteal.impl.anticheat.lifesteal.LifestealIntegrityCheck`

The module definition maps the Lifesteal-specific check families. The first active Lifesteal-specific check is now registered by `LifestealRuntime` as an event-specific anti-cheat check, while the remaining Season 1 families are still being filled in without mixing that logic into the reusable generic checks.

### `shd-lifesteal`

Remains authoritative for gameplay outcomes:

- hearts
- death resolution
- combat tags
- grace period
- eliminations
- revivals
- restricted gameplay rules
- objective state

The anti-cheat may observe, alert, block, or request a correction through public services, but the gameplay mod should still own the actual game rules.

## First Production Behavior

Season 1 anti-cheat should start conservative:

- log evidence
- alert staff
- block obvious impossible actions
- revert clearly illegal item state
- avoid automatic bans for complex movement/combat checks
- reserve immediate action for critical, low-false-positive cases

Good automatic actions:

- remove disabled items
- eject restricted objective items from invalid storage
- block illegal crafting/smithing/anvil/enchant outputs
- block eliminated players from active play
- block grace-period PvP/lifesteal effects
- block obvious restricted command access

Good staff-review actions:

- movement anomalies
- reach/killaura suspicion
- auto-click suspicion
- X-ray/minimap/freecam suspicion
- mobility-assisted kill suspicion
- alt/account correlation
- staff account anomalies

## Action Policy

Detection and punishment must be separate.

Every check should emit a structured result with evidence and a recommended severity. A configurable action policy decides what happens next. This lets us run checks in audit-only mode during testing, tighten specific checks later, and avoid hardcoding ban behavior into detection code.

Supported actions:

- `AUDIT_ONLY`: log evidence and alert staff, but do not remove the player
- `KICK`: disconnect the player without creating a ban record
- `TEMP_BAN`: ban the player until a configured expiration time
- `PERMANENT_BAN`: ban the player until staff manually remove the ban

Optional internal actions may also exist for gameplay correction without treating the player as banned:

- `BLOCK_ACTION`: cancel the suspicious action
- `REVERT_STATE`: undo illegal item/state changes where possible
- `STAFF_REVIEW_REQUIRED`: mark the case for staff review before any punishment

The default production posture should be:

- noisy or probabilistic checks default to `AUDIT_ONLY`
- deterministic rule violations may use `BLOCK_ACTION` or `REVERT_STATE`
- temporary and permanent bans require explicit config per check/category
- staff-triggered detections normally force `AUDIT_ONLY` or `STAFF_REVIEW_REQUIRED`

Initial implementation status:

- `config/shd-lifesteal/anticheat.properties` controls enabled state, default action, temp-ban duration, appeal URL, and per-category action overrides.
- The first service scaffold writes detections into `lifesteal-audit.log` and generates evidence/appeal IDs.
- Operators receive in-game anti-cheat chat alerts for detections at or above `opChatAlerts.minSeverity`, controlled by `opChatAlerts.enabled`, so staff can inspect cases without SSH access to server logs.
- Kick actions produce the correct disconnect screen.
- Temporary and permanent ban actions write to the real server user ban list, include appeal/evidence IDs in the ban reason, then disconnect the player with the same appeal details.
- The service keeps a bounded loaded recent-alert history for staff review and reloads it from persistent JSONL evidence on startup.
- Staff can inspect and operate the foundation with `/lifesteal anticheat status`, `/lifesteal anticheat reload`, `/lifesteal anticheat clear`, `/lifesteal anticheat lookup <evidenceId|appealId>`, `/lifesteal anticheat recent [limit]`, `/lifesteal anticheat player <player> [limit]`, `/lifesteal anticheat open [limit]`, `/lifesteal anticheat mark <evidenceId|appealId> <status> [note]`, and `/lifesteal anticheat note <evidenceId|appealId> <note>`.
- A generic check runner executes reusable server anti-cheat checks once per server tick.
- The first generic check is `movement_anomaly`, a conservative audit-first movement signal controlled by `movement.maxHorizontalPerTick` and `movement.maxVerticalPerTick`.
- Generic combat signals now cover unusual reach, rapid attack timing, multi-target hit bursts, line-of-sight anomalies, unusual damage spikes, and impossible spectator attacks.
- Generic inventory/item integrity signals now cover impossible stacks, stack/damage component overrides, impossible durability, long item names, illegal enchantment levels, and unusually large item-count gains between scans.
- Generic interaction signals now cover unusual block/entity reach, rapid interaction bursts, interactions while a non-player menu is open, and spectator interactions.
- Generic account access signals now cover account name changes, name reuse across UUIDs, network-hash account clusters, and staff/operator logins.
- Generic client integrity signals now cover client brand metadata, client brand changes, configured allowed/blocked brands, and configured required/disallowed networking channels.
- Generic checks can be toggled with `movement.enabled`, `combat.enabled`, `inventory.enabled`, `interaction.enabled`, `account.enabled`, and `client.enabled`.
- Lifesteal-specific integrity checks can be toggled with `lifesteal.enabled`, `lifesteal.scanIntervalTicks`, and `lifesteal.alertCooldownTicks`.

Current Lifesteal-specific coverage:

- online player has persisted Lifesteal state
- non-eliminated player heart count remains within configured bounds
- eliminated player heart display state remains zero
- player applied max-health attribute matches stored Lifesteal hearts
- eliminated player still active on the server
- combat tag active during grace period
- heart state changes while grace period is active
- invalid non-event mace in a player inventory or cursor stack
- invalid non-event mace hidden inside a bundle
- protected Lifesteal items hidden inside bundles, including hearts, Dragon Egg, and tracked event maces
- possible duplicate Dragon Eggs carried by one player
- impossible count of tracked event maces carried by one player
- custom event mace tampering for key, instance, name, and max-damage identity
- active mace registry over-limit, duplicate active keys, and duplicate/blank instance IDs
- loaded Dragon Egg objective duplication across carriers, dropped items, and item frames
- Dragon Egg UI state mismatch when carried/absent state disagrees with loaded observations
- optional End access gate through `lifesteal.endAccessRequiresEvent` and `lifesteal.endEventNameMarker`
- active event timer sanity for blank names and invalid remaining time
- combat logout evidence when a tagged disconnect triggers inventory drop and death resolution
- mobility-assisted tracked mace kill review using current/recent gliding, recent fast falling, active combat mobility cooldown, fall distance, velocity, and attacker/victim positions
- Discord/public gameplay sync HTTP failures, exceptions, and stale sync windows become anti-cheat consistency evidence when role sync is enabled

Persistent anti-cheat files:

- `config/shd-lifesteal/anticheat-history.jsonl`: append-only detection evidence history
- `config/shd-lifesteal/anticheat-reviews.jsonl`: append-only staff review/status events
- `config/shd-lifesteal/anticheat-accounts.json`: local account/client identity observations with hashed IP values, not raw IP addresses

Current staff workflow:

- `OPEN`: new case, not reviewed yet
- `WATCHING`: staff has seen it and wants more evidence
- `REVIEWED`: reviewed without further action
- `FALSE_POSITIVE`: reviewed and considered noise
- `ESCALATED`: needs owner/admin decision
- `ACTIONED`: staff took the intended action

`/lifesteal anticheat open [limit]` lists unresolved `OPEN`, `WATCHING`, and `ESCALATED` cases. Staff notes and marks are persisted separately from the original detection line so evidence remains append-only.

Current generic movement coverage:

- teleport/lag reset threshold to avoid flagging intentional large position changes
- horizontal burst movement
- vertical burst movement
- sustained ground speed
- sustained air speed
- airborne hover/fly suspicion
- repeated upward flight-style movement
- suspicious no-fall/fall-distance reset patterns
- sustained water-surface movement that resembles water-walk/Jesus behavior
- sustained in-block/inside-wall movement that resembles clipping or phasing

Movement checks currently exempt or soften around normal high-variance states:

- creative mode
- spectator mode
- vehicles
- Elytra/gliding
- water/lava
- climbing
- swimming
- Slow Falling
- Levitation

Movement config keys:

- `movement.enabled`
- `movement.teleportResetDistance`
- `movement.maxHorizontalPerTick`
- `movement.maxVerticalPerTick`
- `movement.maxSustainedHorizontalPerTick`
- `movement.maxAirHorizontalPerTick`
- `movement.maxVerticalBurstPerTick`
- `movement.speedBufferTicks`
- `movement.airSpeedBufferTicks`
- `movement.hoverTicks`
- `movement.hoverVerticalPerTick`
- `movement.flyUpwardTicks`
- `movement.flyUpwardPerTick`
- `movement.noFallMinDistance`
- `movement.noFallMinAirTicks`
- `movement.waterWalkTicks`
- `movement.waterWalkMinHorizontalPerTick`
- `movement.clipTicks`
- `movement.alertCooldownTicks`

Current generic combat coverage:

- reach from attacker eye position to the target hitbox
- vertical reach
- rapid confirmed-hit timing
- repeated low attack-cooldown hits
- multi-target hit bursts
- repeated fast target switching
- repeated hits without normal line of sight
- attacks while a non-player inventory/menu is open
- attacks while using or blocking with an item
- suspicious airborne hit/critical-style patterns
- unusually large combat damage spikes
- impossible spectator attacks
- attacks while blinded

Combat checks are buffer-based where false positives are plausible. A single strange hit usually becomes evidence only after repeated suspicious samples inside the configured window.

Combat config keys:

- `combat.enabled`
- `combat.maxReachBlocks`
- `combat.maxVerticalReachBlocks`
- `combat.minAttackIntervalTicks`
- `combat.rapidAttackBuffer`
- `combat.lowCooldownThreshold`
- `combat.lowCooldownBuffer`
- `combat.multiTargetWindowTicks`
- `combat.maxTargetsPerWindow`
- `combat.targetSwitchBuffer`
- `combat.lineOfSightBuffer`
- `combat.menuAttackBuffer`
- `combat.usingItemAttackBuffer`
- `combat.criticalBuffer`
- `combat.criticalMinFallDistance`
- `combat.maxDamageTaken`
- `combat.damageSpikeBuffer`
- `combat.alertCooldownTicks`

Current generic inventory/item integrity coverage:

- item count above the stack's actual max count
- item count above the configured generic stack cap
- item `MAX_STACK_SIZE` component above the configured generic stack cap
- damageable item damage below zero or above max damage
- item `MAX_DAMAGE` component above the configured generic damage cap
- item display name longer than the configured name length
- enchantment or stored-enchantment levels below 1 or above vanilla max plus configured tolerance
- unusually large per-item count gains between inventory scans

The item-count delta check is intentionally broad and audit-first. It is useful for catching obvious duplication signatures, but normal gameplay, staff grants, kits, or container movement can still create noisy evidence.

The default stack cap is intentionally set high enough for server-issued kit potion stacks. Future non-Lifesteal events can lower `inventory.maxAllowedStackSize` if they want stricter vanilla-style inventory integrity.

Inventory config keys:

- `inventory.enabled`
- `inventory.scanIntervalTicks`
- `inventory.maxAllowedStackSize`
- `inventory.maxAllowedDamage`
- `inventory.maxItemNameLength`
- `inventory.enchantmentLevelTolerance`
- `inventory.trackItemDeltas`
- `inventory.maxSingleScanItemGain`
- `inventory.alertCooldownTicks`

Current generic interaction coverage:

- block interaction reach
- entity interaction reach
- block attack reach
- entity attack reach before damage resolution
- rapid repeated interaction samples
- use/attack interactions while a non-player menu is open
- spectator use/attack interactions

Interaction config keys:

- `interaction.enabled`
- `interaction.maxBlockReach`
- `interaction.maxEntityReach`
- `interaction.minIntervalTicks`
- `interaction.rapidBuffer`
- `interaction.menuBuffer`
- `interaction.spectatorBuffer`
- `interaction.alertCooldownTicks`

Current generic account access coverage:

- Minecraft UUID observed with a changed account name
- the same Minecraft name observed on another UUID
- more than the configured number of UUIDs observed on the same hashed network value
- operator/staff account login audit events

Account access config keys:

- `account.enabled`
- `account.alertNameChanges`
- `account.alertNameReuse`
- `account.alertIpClusters`
- `account.maxAccountsPerIpHash`
- `account.alertStaffLogin`

Current generic client integrity coverage:

- client brand payload missing after a grace period, when brand receiver registration is available
- blank or unusually long client brand payloads
- client brand changed compared to the local account history
- client brand is in `client.blockedBrands`
- `client.allowedBrands` is non-empty and the observed brand is not in the allow list
- required client networking channels are missing
- disallowed client networking channels are declared

Client integrity config keys:

- `client.enabled`
- `client.requireBrand`
- `client.brandGraceTicks`
- `client.trackBrandChanges`
- `client.allowedBrands`
- `client.blockedBrands`
- `client.requiredChannels`
- `client.disallowedChannels`

### Disconnect And Appeal UX

Any action that disconnects a player must show a clear disconnect screen.

The message should include:

- action type: kick, temporary ban, or permanent ban
- short human-readable reason
- appeal ID
- appeal destination or instructions
- temporary ban expiration when applicable

Example fields:

- `appealId`
- `reasonCode`
- `publicReason`
- `action`
- `expiresAt`
- `evidenceId`

The appeal ID should be generated when the enforcement action is created and saved with the evidence record. Staff should be able to search by appeal ID, player UUID, evidence ID, or timestamp.

The player-facing reason should be clear but not leak detection internals. For example, say "Unfair combat advantage detected" instead of exposing exact reach thresholds or packet details.

## Evidence Model

Every alert-worthy case should try to capture:

- player name and UUID
- timestamp
- world/dimension
- position
- recent movement context
- recent combat context
- recent inventory context
- relevant victim/attacker
- relevant item stack data
- relevant objective state
- combat tag state
- grace/event phase state
- staff/admin context
- action taken: observed, blocked, reverted, alerted, punished

Core should collect generic evidence. Lifesteal should enrich with season state.

## Severity

Use four severities:

- `INFO`: unusual but probably harmless
- `WARNING`: suspicious and worth watching
- `HIGH`: likely abuse, staff should review soon
- `CRITICAL`: competitive-impacting or integrity-breaking, staff should be alerted immediately

Critical examples:

- possible heart duplication
- illegal heart gain
- unapproved custom mace active in gameplay
- dragon egg holder/location mismatch
- eliminated player active on server
- restricted item used in combat
- combat logout during an active fight
- mobility-assisted prohibited mace kill
- End access before opening
- public API exposing hidden objective data

## Suggested Build Order

### Phase 1: Shared Core Scaffold

- alert/evidence data model
- central anti-cheat service
- severity and category enums
- structured server log output
- staff-safe audit path
- simple Discord/admin alert bridge hook
- rolling per-player history
- config for enabled checks and thresholds

No heavy detections yet. This phase creates the rails.

### Phase 2: Lifesteal Integrity Checks

Start with checks that are mostly deterministic and low false-positive:

- heart count cannot exceed configured max
- eliminated players cannot remain active
- grace period cannot produce heart loss, heart drops, eliminations, or combat tags
- combat logout path must produce the expected death-resolution result
- heart items may only exist in allowed locations
- dragon egg may only exist in allowed locations
- custom maces must have approved identity
- duplicate active custom maces alert as critical
- restricted item cleanup emits evidence when it affects competitive items

This protects the season before we chase noisy packet-level checks.

### Phase 3: Generic Inventory And Restricted Item Checks

- restricted item possession/creation/use alerts
- illegal enchantment levels
- invalid NBT on protected items
- crafting/smithing/anvil/enchant bypass attempts
- hopper/dropper/dispenser/crafter paths
- chunk-load and restart consistency checks
- repeated blocked-attempt history

Most of this belongs in core with Lifesteal-provided policies.

### Phase 4: Combat And Mobility Review Checks

- combat tag bypass detection
- suspicious kill attribution
- impossible reach and line-of-sight evidence
- attack timing and auto-click signals
- Elytra/pearl/trident movement around combat
- Elytra-to-chestplate mace drop review alerts
- Riptide/pearl-assisted kill review alerts
- no-fall and abnormal acceleration signals

Treat this phase as alert-first. Movement/combat false positives can be expensive during a live event.

### Phase 5: Client/Information/Alt Risk

- client brand/mod metadata if policy allows it
- required SHD client mod presence if required by event rules
- minimap/worldmap/freecam policy enforcement or alerts
- suspicious X-ray/resource discovery patterns
- eliminated-player scouting
- shared-IP approval consistency
- Discord/Minecraft link mismatches
- whitelist/public roster mismatches

This phase may need legal/privacy and policy decisions before implementation.

## Lifesteal APIs Needed By The Add-On

The add-on should integrate through stable APIs. Missing state should be exposed deliberately instead of reading implementation classes.

Likely required API access:

- player heart state
- elimination state
- grace period snapshot
- combat tag snapshot
- current objective/dragon egg state
- custom mace identity validation
- restricted item policy result
- event phase/window state
- staff/admin action context

If an API does not exist yet, add the smallest read-only method needed.

## Staff Handling

Staff should not be silently exempt.

Staff cases should usually become audit/review events instead of automatic punishments. This catches mistakes, test commands run in the wrong environment, and compromised staff accounts without making normal administration painful.

Staff alerts should include:

- staff identity
- command or action source
- whether the staff member was in gameplay or admin context
- affected player/item/objective
- whether competitive state changed
- audit correlation ID when available

## Launch Gate

Before Season 1 launch, verify on a real dedicated server:

- normal vanilla gameplay
- expected modded client setup
- high-ping players
- low-TPS behavior
- real PvP fights
- grace start/end
- combat logging
- Elytra/pearl/trident combat restrictions
- heart death transfer
- restricted item crafting and storage
- custom mace issue/tracking/cleanup
- dragon egg tracking
- End opening/event state
- restart/reconnect/chunk-load edge cases
- staff command flows

LAN testing is not enough for final anti-cheat decisions.

## Whitelist And Applications

Server access should be tied to the application/join-ticket approval flow.

When a join ticket or application is approved, regardless of whether approval happens through Discord, the admin portal, or another staff surface, the player's Minecraft UUID or username should be added to the server whitelist automatically. Players should not be able to join the event server before they are approved and whitelisted.

The current Discord bot/admin API still has legacy RCON hooks for some approval paths, but production should move whitelist and ban synchronization into the Fabric mod. The planned direction is a protected bot endpoint that exposes active/approved and denied/banned Minecraft identities, while the Lifesteal mod polls that endpoint over outbound HTTPS and applies whitelist/ban changes locally. If staff leave the Minecraft UUID blank for a manual player, the bot stores a `manual:<name>` placeholder and replaces it with the real UUID the first time that exact Minecraft name reaches the join check.

This whitelist automation must not change the public/player-page registration state. Approved applicants can remain shown as registered even if the final event roster is smaller than the total approved applicant pool.

## Open Decisions

- exact module names and repo locations
- whether anti-cheat lives in this repo now or becomes its own shared repo later
- whether Season 1 requires a client-side SHD validation mod
- minimap/worldmap/freecam policy: block, alert, or rules-only
- exact alert destination for critical events
- exact punishment policy per check/category
- ban duration presets for temporary bans
- appeal ID format and where appeal records live
- final player-facing disconnect message copy
- persistence format for anti-cheat history
- admin UI scope for reviewing alerts
- thresholds for noisy movement/combat checks
- whether any critical checks should auto-kick or only alert
