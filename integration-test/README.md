# SHD Integration Test

This folder stages the current build jars for testing the first UI pipeline:

`shd-lifesteal` -> `shd-core` -> `shd-ui-client`

## Jars

Copy these into a Fabric client/server `mods` folder for testing:

- `mods/shd-lifesteal-0.1.0.jar`
- `mods/shd-lifesteal-client-0.1.0.jar`
- `mods/shd-core-0.1.0.jar`
- `mods/shd-ui-client-0.1.0.jar`

To refresh only the Lifesteal jar in this integration folder and the local test server, run:

`.\update-lifesteal-jar.ps1`

Server:

- Required: `shd-lifesteal`
- Required: `shd-core`
- Do not install `shd-ui-client` on a dedicated server because it is client-only.

Client:

- Required: `shd-lifesteal-client`
- Required: `shd-core`
- Required: `shd-ui-client`
- Optional for local integrated testing: `shd-lifesteal`

Client integrity check:

- The client should declare `shd-lifesteal-client:integrity`.
- The server should receive `shd-lifesteal-client:mod_report` within the anti-cheat brand grace window.
- If operators see `client_missing_mod_report`, rebuild `LIFESTEAL-CLIENT`, rerun `stage-mods.ps1`, and make sure the refreshed `shd-lifesteal-client-0.1.0.jar` is installed in the client `mods` folder.

## Load Checks

Expected log lines:

- `SHD Lifesteal initialized`
- `SHD Core initialized`
- `SHD UI Client initialized`
- Lifesteal should log that it loaded a UI bridge from `shd-core`

## HUD Checks

### UI Feature Config Commands

Run on the server as an operator:

`/shdui feature list`

Check one feature:

`/shdui feature status <feature>`

Enable or disable one feature:

- `/shdui feature <feature> on`
- `/shdui feature <feature> off`

Feature keys:

- `grace_timer`
- `combat_timer`
- `dragon_egg_hud`
- `heart_popups`
- `milestone_popups`
- `staff_alerts`
- `tab`
- `scoreboard`
- `grace_warnings`
- `join_leave_messages`

Expected:

- Changes are saved to `config/shd-core/ui-features.properties`.
- Core syncs the updated config to connected UI clients.
- Lifesteal checks the Core bridge before emitting server-driven UI events such as grace warnings and join/leave messages.

### Prefixes, Suffixes, and Tab

Set staff/gameplay prefixes:

`/shdui prefix set <player> owner`

Manual staff roles:

- `shd_team`
- `admin`
- `mod`

Clear a prefix:

`/shdui prefix clear <player>`

Expected:

- Tab rows show manual staff prefixes: `[Owner]`, `[SHD Team]`, `[Admin]`, or `[Mod]`.
- `[Mace]` and `[Egg]` are assigned automatically from Lifesteal gameplay role sync.
- Manually trying to assign `mace` or `egg` should fail with a message saying Lifesteal assigns it automatically.
- Tab rows show a heart suffix like `❤ 12`.
- Tab header shows `SHD Lifesteal`, event timer, and egg status.
- Tab footer shows online count, staff count, and beta label.

### Toggleable Scoreboard

Run on the client:

`/ui scoreboard`

Optional:

- `/ui scoreboard on`
- `/ui scoreboard off`

Expected:

- A right-side SHD Lifesteal panel appears.
- It shows hearts, kills, deaths, and event timer.
- Kills/deaths are synced from Lifesteal through Core gameplay role state.

### Grace Timer

Run:

`/lifesteal grace start`

Expected:

- A cyan `Grace: MM:SS` timer appears above the hotbar.

Run:

`/lifesteal grace pause`

Expected:

- The timer changes to `Grace paused: MM:SS`.

Grace warnings:

- At 10 minutes, 5 minutes, 1 minute, and 10 seconds, players receive a server-wide grace warning.
- When grace ends, players receive `Grace Period Ended`.
- The UI client shows these grace warnings as short cyan popups.

### Join and Leave Messages

Expected:

- Joining players broadcast as green `[+] Player`.
- Leaving players broadcast as red `[-] Player`.
- If vanilla join/leave messages still appear during live testing, add a focused mixin to suppress the vanilla message.

### Combat Timer

Have one player hit another outside grace.

Expected:

- A red `Combat: MM:SS` timer appears above the hotbar for tagged players.
- Timer disappears when combat tag clears.

### Dragon Egg Status

Place a dragon egg, put one in an item frame, drop one, and carry one.

Expected:

- Top-center pink/magenta status appears.
- Placed/item-frame egg shows exact coordinates.
- Dropped/carried egg shows approximate X/Z.
- Dropped/placed/item-frame egg should show the vertical particle beam.

### Heart Events

Kill a player outside grace.

Expected:

- Victim sees `-1 Heart`.
- Killer sees `+1 Heart` if below max hearts.
- Victim/killer see a short center-screen popup for their personal heart notice.
- Server-wide message appears for heart steal or heart drop cases.

### Milestone Events

Trigger these states:

- A player reaches 20 hearts.
- A player starts carrying the dragon egg.
- A player starts carrying a mace.

Expected:

- 20 hearts broadcasts a milestone event.
- Dragon egg pickup/carry broadcasts an approximate X/Z location.
- Mace acquired broadcasts a milestone event.
- UI client shows milestone events as short gold popups.

### Staff Alert

Disconnect while combat tagged.

Expected:

- Operators see a `[SHD HIGH] Combat logout` staff message.
- Core sync sends staff alerts only to operators.
- UI client shows staff alerts in a left-side alert stack.
- Combat logout death resolution still applies.

### Disabled Feature Popup

Try using a blocked item/action, such as an end crystal or combat-tagged ender pearl.

Expected:

- The player sees a specific actionbar message.
- The player also sees a short yellow center-screen popup.
- Other players should not receive that personal disabled-feature notice.

## Known Next Polish

- Tune exact HUD placement after visual testing.
- Add animated heart gain/loss popups in `shd-ui-client`.
- Add revival UI.
- Add bot/Discord-related UI when the bot bridge is ready.
- Polish tab and scoreboard layout after in-game visual testing.
- Add low-heart warning.
- Add configurable sound cues.
