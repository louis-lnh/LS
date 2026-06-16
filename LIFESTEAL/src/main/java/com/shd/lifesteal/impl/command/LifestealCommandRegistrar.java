package com.shd.lifesteal.impl.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.builder.RequiredArgumentBuilder;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.shd.lifesteal.api.HeartChangeReason;
import com.shd.lifesteal.api.HeartChangeResult;
import com.shd.lifesteal.api.PlayerHeartState;
import com.shd.lifesteal.impl.audit.LifestealAuditLog;
import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.combat.CombatTagSnapshot;
import com.shd.lifesteal.impl.event.EventTimerService;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.item.ModItems;
import com.shd.lifesteal.impl.kit.EventKitService;
import com.shd.lifesteal.impl.player.ResolvedPlayer;
import com.shd.lifesteal.impl.player.WhitelistPlayerResolver;
import com.shd.lifesteal.impl.player.WhitelistedPlayerArgumentType;
import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import com.shd.lifesteal.impl.ui.LifestealSoundService;
import com.shd.lifesteal.impl.ui.LifestealUiSettings;
import com.shd.lifesteal.impl.ui.TimeText;
import java.time.Duration;
import java.time.Instant;
import net.minecraft.command.CommandSource;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.item.ItemStack;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class LifestealCommandRegistrar {
    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;
    private final ModItems modItems;
    private final WhitelistPlayerResolver playerResolver;
    private final CombatTagService combatTagService;
    private final GracePeriodService gracePeriodService;
    private final EventTimerService eventTimerService;
    private final LifestealUiSettings uiSettings;
    private final LifestealSoundService soundService;
    private final LifestealAuditLog auditLog;
    private final EventKitService eventKitService = new EventKitService();

    public LifestealCommandRegistrar(
            HeartService heartService,
            PlayerHeartApplier playerHeartApplier,
            ModItems modItems,
            WhitelistPlayerResolver playerResolver,
            CombatTagService combatTagService,
            GracePeriodService gracePeriodService,
            EventTimerService eventTimerService,
            LifestealUiSettings uiSettings,
            LifestealSoundService soundService,
            LifestealAuditLog auditLog
    ) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
        this.modItems = modItems;
        this.playerResolver = playerResolver;
        this.combatTagService = combatTagService;
        this.gracePeriodService = gracePeriodService;
        this.eventTimerService = eventTimerService;
        this.uiSettings = uiSettings;
        this.soundService = soundService;
        this.auditLog = auditLog;
    }

    public void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> register(dispatcher));
    }

    private void register(CommandDispatcher<ServerCommandSource> dispatcher) {
        dispatcher.register(CommandManager.literal("lifesteal")
                .then(CommandManager.literal("status")
                        .executes(context -> statusSelf(context.getSource()))
                        .then(playerArgument("player")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> status(
                                        context.getSource(),
                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver)
                                ))))
                .then(CommandManager.literal("hearts")
                        .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                        .then(CommandManager.literal("set")
                                .then(playerArgument("player")
                                        .then(CommandManager.argument("amount", IntegerArgumentType.integer(1, heartService.maxHearts()))
                                                .executes(context -> changeHearts(
                                                        context.getSource(),
                                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                        IntegerArgumentType.getInteger(context, "amount"),
                                                        HeartCommandMode.SET
                                                )))))
                        .then(CommandManager.literal("add")
                                .then(playerArgument("player")
                                        .then(CommandManager.argument("amount", IntegerArgumentType.integer(1, heartService.maxHearts()))
                                                .executes(context -> changeHearts(
                                                        context.getSource(),
                                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                        IntegerArgumentType.getInteger(context, "amount"),
                                                        HeartCommandMode.ADD
                                                )))))
                        .then(CommandManager.literal("remove")
                                .then(playerArgument("player")
                                        .then(CommandManager.argument("amount", IntegerArgumentType.integer(1, heartService.maxHearts()))
                                                .executes(context -> changeHearts(
                                                        context.getSource(),
                                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                        IntegerArgumentType.getInteger(context, "amount"),
                                                        HeartCommandMode.REMOVE
                                                ))))))
                .then(CommandManager.literal("player")
                        .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                        .then(CommandManager.literal("eliminate")
                                .then(playerArgument("player")
                                        .executes(context -> eliminatePlayer(
                                                context.getSource(),
                                                WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver)
                                        ))))
                        .then(CommandManager.literal("revive")
                                .then(playerArgument("player")
                                        .executes(context -> revivePlayer(
                                                context.getSource(),
                                                WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver)
                                        ))))
                        .then(CommandManager.literal("reset")
                                .then(playerArgument("player")
                                        .executes(context -> resetPlayer(
                                                context.getSource(),
                                                WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver)
                                        )))))
                .then(CommandManager.literal("grace")
                        .then(CommandManager.literal("status")
                                .executes(context -> graceStatus(context.getSource())))
                        .then(CommandManager.literal("start")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> startGrace(context.getSource())))
                        .then(CommandManager.literal("end")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> endGrace(context.getSource())))
                        .then(CommandManager.literal("pause")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> pauseGrace(context.getSource())))
                        .then(CommandManager.literal("resume")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> resumeGrace(context.getSource()))))
                .then(CommandManager.literal("event")
                        .then(CommandManager.literal("status")
                                .executes(context -> eventStatus(context.getSource())))
                        .then(CommandManager.literal("start")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .then(CommandManager.argument("minutes", IntegerArgumentType.integer(1, 10080))
                                        .then(CommandManager.argument("name", StringArgumentType.greedyString())
                                                .executes(context -> startEvent(
                                                        context.getSource(),
                                                        IntegerArgumentType.getInteger(context, "minutes"),
                                                        StringArgumentType.getString(context, "name")
                                                )))))
                        .then(CommandManager.literal("end")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> endEvent(context.getSource())))
                        .then(CommandManager.literal("pause")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> pauseEvent(context.getSource())))
                        .then(CommandManager.literal("resume")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .executes(context -> resumeEvent(context.getSource()))))
                .then(CommandManager.literal("mace")
                        .requires(CommandManager.requirePermissionLevel(CommandManager.OWNERS_CHECK))
                        .then(maceCommand(MaceLimitRules.MACE_ONE))
                        .then(maceCommand(MaceLimitRules.MACE_TWO)))
                .then(CommandManager.literal("kit")
                        .requires(CommandManager.requirePermissionLevel(CommandManager.OWNERS_CHECK))
                        .then(CommandManager.literal("Wemmbu")
                                .executes(context -> eventKitService.give(
                                        context.getSource(),
                                        "Wemmbu",
                                        false
                                ))
                                .then(CommandManager.literal("unbreakable")
                                        .executes(context -> eventKitService.give(
                                                context.getSource(),
                                                "Wemmbu",
                                                true
                                        ))))
                        .then(CommandManager.literal("FlameFrags")
                                .executes(context -> eventKitService.give(
                                        context.getSource(),
                                        "FlameFrags",
                                        false
                                ))
                                .then(CommandManager.literal("unbreakable")
                                        .executes(context -> eventKitService.give(
                                                context.getSource(),
                                                "FlameFrags",
                                                true
                                        ))))
                        .then(CommandManager.literal("Shared")
                                .executes(context -> eventKitService.give(
                                        context.getSource(),
                                        "Shared",
                                        false
                                ))
                                .then(CommandManager.literal("unbreakable")
                                        .executes(context -> eventKitService.give(
                                                context.getSource(),
                                                "Shared",
                                                true
                                        ))))
                        .then(CommandManager.literal("Tools")
                                .executes(context -> eventKitService.give(
                                        context.getSource(),
                                        "Tools",
                                        false
                                ))
                                .then(CommandManager.literal("unbreakable")
                                        .executes(context -> eventKitService.give(
                                                context.getSource(),
                                                "Tools",
                                                true
                                        ))))
                        .then(CommandManager.literal("Items")
                                .executes(context -> eventKitService.give(
                                        context.getSource(),
                                        "Items",
                                        false
                                )))
                        .then(CommandManager.literal("Potions")
                                .executes(context -> eventKitService.give(
                                        context.getSource(),
                                        "Potions",
                                        false
                                )))
                        .then(CommandManager.literal("Potion")
                                .then(CommandManager.literal("Stack")
                                        .executes(context -> eventKitService.give(
                                                context.getSource(),
                                                "Potion Stack",
                                                false
                                        )))
                                .then(CommandManager.literal("Mix")
                                        .executes(context -> eventKitService.give(
                                                context.getSource(),
                                                "Potion Mix",
                                                false
                                        )))))
                .then(CommandManager.literal("ui")
                        .then(CommandManager.literal("status")
                                .executes(context -> uiStatus(context.getSource())))
                        .then(CommandManager.literal("feature")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .then(CommandManager.argument("feature", StringArgumentType.word())
                                        .suggests((context, builder) -> CommandSource.suggestMatching(
                                                java.util.List.of(
                                                        LifestealUiSettings.ACTIONBAR,
                                                        LifestealUiSettings.TAB,
                                                        LifestealUiSettings.SCOREBOARD,
                                                        LifestealUiSettings.BOSSBAR,
                                                        LifestealUiSettings.SOUNDS
                                                ),
                                                builder
                                        ))
                                        .then(CommandManager.literal("on")
                                                .executes(context -> setUiFeature(
                                                        context.getSource(),
                                                        StringArgumentType.getString(context, "feature"),
                                                        true
                                                )))
                                        .then(CommandManager.literal("off")
                                                .executes(context -> setUiFeature(
                                                        context.getSource(),
                                                        StringArgumentType.getString(context, "feature"),
                                                        false
                                                )))))
                        .then(CommandManager.literal("sound")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .then(CommandManager.argument("type", StringArgumentType.word())
                                        .suggests((context, builder) -> CommandSource.suggestMatching(
                                                java.util.List.of("death", "elimination", "revival"),
                                                builder
                                        ))
                                        .then(CommandManager.argument("sound", StringArgumentType.word())
                                                .suggests((context, builder) -> CommandSource.suggestMatching(
                                                        java.util.List.of(
                                                                "wither_spawn",
                                                                "wither_death",
                                                                "beacon_activate",
                                                                "totem_use",
                                                                "player_levelup",
                                                                "end_portal_spawn",
                                                                "ender_dragon_growl",
                                                                "warden_death",
                                                                "off"
                                                        ),
                                                        builder
                                                ))
                                                .executes(context -> setUiSound(
                                                        context.getSource(),
                                                        StringArgumentType.getString(context, "type"),
                                                        StringArgumentType.getString(context, "sound")
                                                )))))
                        .then(CommandManager.literal("prefix")
                                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                                .then(CommandManager.literal("list")
                                        .executes(context -> prefixList(context.getSource())))
                                .then(CommandManager.argument("role", StringArgumentType.word())
                                        .suggests((context, builder) -> CommandSource.suggestMatching(
                                                java.util.List.of("owner", "admin", "mod", "shd_team"),
                                                builder
                                        ))
                                        .then(CommandManager.literal("add")
                                                .then(CommandManager.argument("player", StringArgumentType.word())
                                                        .suggests((context, builder) -> CommandSource.suggestMatching(
                                                                playerResolver.suggestNames(context.getSource().getServer()),
                                                                builder
                                                        ))
                                                        .executes(context -> setPrefixRole(
                                                                context.getSource(),
                                                                StringArgumentType.getString(context, "role"),
                                                                StringArgumentType.getString(context, "player"),
                                                                true
                                                        ))))
                                        .then(CommandManager.literal("remove")
                                                .then(CommandManager.argument("player", StringArgumentType.word())
                                                        .suggests((context, builder) -> CommandSource.suggestMatching(
                                                                playerResolver.suggestNames(context.getSource().getServer()),
                                                                builder
                                                        ))
                                                        .executes(context -> setPrefixRole(
                                                                context.getSource(),
                                                                StringArgumentType.getString(context, "role"),
                                                                StringArgumentType.getString(context, "player"),
                                                                false
                                                        ))))))));
        dispatcher.register(CommandManager.literal("withdraw")
                .then(CommandManager.argument("amount", IntegerArgumentType.integer(1, heartService.maxHearts() - 1))
                        .executes(context -> withdraw(
                                context.getSource(),
                                IntegerArgumentType.getInteger(context, "amount")
                        ))));
    }

    private RequiredArgumentBuilder<ServerCommandSource, String> playerArgument(String name) {
        return CommandManager.argument(name, StringArgumentType.word())
                .suggests((context, builder) -> CommandSource.suggestMatching(
                        playerResolver.suggestNames(context.getSource().getServer()),
                        builder
                ));
    }

    private LiteralArgumentBuilder<ServerCommandSource> maceCommand(String key) {
        return CommandManager.literal(key)
                .executes(context -> giveMace(context.getSource(), key, null, false))
                .then(playerArgument("player")
                        .executes(context -> giveMace(
                                context.getSource(),
                                key,
                                WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                false
                        ))
                        .then(CommandManager.argument("trackable", StringArgumentType.word())
                                .suggests((context, builder) -> CommandSource.suggestMatching(java.util.List.of("yes", "no"), builder))
                                .executes(context -> giveMace(
                                        context.getSource(),
                                        key,
                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                        trackableArgument(StringArgumentType.getString(context, "trackable"))
                                ))));
    }

    private int statusSelf(ServerCommandSource source) throws CommandSyntaxException {
        ServerPlayerEntity player = source.getPlayerOrThrow();
        return status(source, new ResolvedPlayer(
                player.getUuid(),
                player.getName().getString(),
                java.util.Optional.of(player)
        ));
    }

    private int status(ServerCommandSource source, ResolvedPlayer player) {
        PlayerHeartState state = heartService.ensurePlayer(player.playerId());
        String combatText = combatTagService.snapshot(player.playerId(), Instant.now())
                .map(snapshot -> " Combat tagged for %ds by %s.".formatted(
                        snapshot.remainingSeconds(),
                        attackerName(source, snapshot)
                ))
                .orElse("");
        source.sendFeedback(() -> Text.literal("%s has %d/%d hearts%s".formatted(
                player.name(),
                state.hearts(),
                heartService.maxHearts(),
                state.eliminated() ? " and is eliminated" : ""
        ) + combatText), false);
        return state.hearts();
    }

    private int giveMace(ServerCommandSource source, String key, ResolvedPlayer target, boolean trackable) throws CommandSyntaxException {
        ServerPlayerEntity recipient = target == null
                ? source.getPlayerOrThrow()
                : target.onlinePlayer().orElse(null);
        if (recipient == null) {
            source.sendError(Text.literal("Target player must be online to receive an event mace."));
            return 0;
        }

        String normalizedKey = MaceLimitRules.normalizeMaceKey(key).orElse(key);
        ItemStack mace = MaceLimitRules.createEventMace(
                source.getRegistryManager(),
                normalizedKey,
                trackable,
                "issued by " + source.getName() + " to " + recipient.getName().getString(),
                recipient
        );
        recipient.giveOrDropStack(mace);
        source.sendFeedback(() -> Text.literal("Gave %s to %s%s.".formatted(
                normalizedKey,
                recipient.getName().getString(),
                trackable ? " and marked it as tracked" : ""
        )), true);
        return 1;
    }

    private boolean trackableArgument(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
        return normalized.equals("yes") || normalized.equals("true") || normalized.equals("trackable");
    }

    private String attackerName(ServerCommandSource source, CombatTagSnapshot snapshot) {
        ServerPlayerEntity attacker = source.getServer().getPlayerManager().getPlayer(snapshot.recentAttacker());
        if (attacker == null) {
            return snapshot.recentAttacker().toString();
        }
        return attacker.getName().getString();
    }

    private int changeHearts(ServerCommandSource source, ResolvedPlayer player, int amount, HeartCommandMode mode) {
        HeartChangeResult result = switch (mode) {
            case SET -> heartService.setHearts(player.playerId(), amount, HeartChangeReason.ADMIN);
            case ADD -> heartService.addHearts(player.playerId(), amount, HeartChangeReason.ADMIN);
            case REMOVE -> heartService.removeHearts(player.playerId(), amount, HeartChangeReason.ADMIN);
        };

        player.onlinePlayer().ifPresent(onlinePlayer -> playerHeartApplier.applyHearts(onlinePlayer, result.newHearts()));
        String onlineSuffix = player.online() ? "" : " (offline, applies on next join)";
        source.sendFeedback(() -> Text.literal("%s hearts: %d -> %d%s".formatted(
                player.name(),
                result.previousHearts(),
                result.newHearts(),
                onlineSuffix
        )), true);
        return result.newHearts();
    }

    private int eliminatePlayer(ServerCommandSource source, ResolvedPlayer player) {
        PlayerHeartState state = heartService.eliminate(player.playerId());
        player.onlinePlayer().ifPresent(onlinePlayer -> onlinePlayer.networkHandler.disconnect(Text.translatable("text.shd-lifesteal.eliminated")));
        source.sendFeedback(() -> Text.literal("%s is now eliminated".formatted(player.name())), true);
        return state.hearts();
    }

    private int revivePlayer(ServerCommandSource source, ResolvedPlayer player) {
        PlayerHeartState state = heartService.revive(player.playerId());
        player.onlinePlayer().ifPresent(onlinePlayer -> playerHeartApplier.applyHearts(onlinePlayer, state.hearts()));
        soundService.playGlobal(source.getServer(), LifestealSoundService.REVIVAL);
        String onlineSuffix = player.online() ? "" : " (offline, applies on next join)";
        source.sendFeedback(() -> Text.literal("%s revived with %d hearts%s".formatted(
                player.name(),
                state.hearts(),
                onlineSuffix
        )), true);
        return state.hearts();
    }

    private int resetPlayer(ServerCommandSource source, ResolvedPlayer player) {
        PlayerHeartState state = heartService.reset(player.playerId());
        player.onlinePlayer().ifPresent(onlinePlayer -> playerHeartApplier.applyHearts(onlinePlayer, state.hearts()));
        String onlineSuffix = player.online() ? "" : " (offline, applies on next join)";
        source.sendFeedback(() -> Text.literal("%s reset to %d hearts%s".formatted(
                player.name(),
                state.hearts(),
                onlineSuffix
        )), true);
        return state.hearts();
    }

    private int graceStatus(ServerCommandSource source) {
        var snapshot = gracePeriodService.snapshot();
        source.sendFeedback(() -> Text.literal("Grace period: %s%s".formatted(
                snapshot.active() ? "active" : "inactive",
                snapshot.active() ? " (%s remaining%s)".formatted(TimeText.compact(snapshot.remaining()), snapshot.paused() ? ", paused" : "") : ""
        )), false);
        return snapshot.active() ? 1 : 0;
    }

    private int startGrace(ServerCommandSource source) {
        gracePeriodService.start(Instant.now());
        source.sendFeedback(() -> Text.literal("Grace period started: %s remaining".formatted(TimeText.compact(gracePeriodService.snapshot().remaining()))), true);
        return 1;
    }

    private int endGrace(ServerCommandSource source) {
        gracePeriodService.end(Instant.now());
        source.sendFeedback(() -> Text.literal("Grace period ended."), true);
        return 1;
    }

    private int pauseGrace(ServerCommandSource source) {
        gracePeriodService.pause(Instant.now());
        source.sendFeedback(() -> Text.literal("Grace period paused: %s remaining".formatted(TimeText.compact(gracePeriodService.snapshot().remaining()))), true);
        return 1;
    }

    private int resumeGrace(ServerCommandSource source) {
        gracePeriodService.resume(Instant.now());
        source.sendFeedback(() -> Text.literal("Grace period resumed: %s remaining".formatted(TimeText.compact(gracePeriodService.snapshot().remaining()))), true);
        return 1;
    }

    private int eventStatus(ServerCommandSource source) {
        EventTimerService.Snapshot snapshot = eventTimerService.snapshot();
        source.sendFeedback(() -> Text.literal("Event timer: %s%s".formatted(
                snapshot.active() ? snapshot.name() : "inactive",
                snapshot.active() ? " (%s remaining%s)".formatted(TimeText.compact(snapshot.remaining()), snapshot.paused() ? ", paused" : "") : ""
        )), false);
        return snapshot.active() ? 1 : 0;
    }

    private int startEvent(ServerCommandSource source, int minutes, String name) {
        eventTimerService.start(name, Duration.ofMinutes(minutes), Instant.now());
        source.sendFeedback(() -> Text.literal("Event timer started: %s for %s".formatted(name, TimeText.compact(Duration.ofMinutes(minutes)))), true);
        return 1;
    }

    private int endEvent(ServerCommandSource source) {
        eventTimerService.end();
        source.sendFeedback(() -> Text.literal("Event timer ended."), true);
        return 1;
    }

    private int pauseEvent(ServerCommandSource source) {
        eventTimerService.pause(Instant.now());
        EventTimerService.Snapshot snapshot = eventTimerService.snapshot();
        source.sendFeedback(() -> Text.literal(snapshot.active()
                ? "Event timer paused: %s remaining".formatted(TimeText.compact(snapshot.remaining()))
                : "No active event timer."), true);
        return snapshot.active() ? 1 : 0;
    }

    private int resumeEvent(ServerCommandSource source) {
        eventTimerService.resume(Instant.now());
        EventTimerService.Snapshot snapshot = eventTimerService.snapshot();
        source.sendFeedback(() -> Text.literal(snapshot.active()
                ? "Event timer resumed: %s remaining".formatted(TimeText.compact(snapshot.remaining()))
                : "No paused event timer."), true);
        return snapshot.active() ? 1 : 0;
    }

    private int uiStatus(ServerCommandSource source) {
        source.sendFeedback(() -> Text.literal("Lifesteal UI: " + uiSettings.featuresText()), false);
        return 1;
    }

    private int setUiFeature(ServerCommandSource source, String feature, boolean enabled) {
        if (!uiSettings.setEnabled(feature, enabled)) {
            source.sendError(Text.literal("Unknown UI feature: " + feature));
            return 0;
        }
        source.sendFeedback(() -> Text.literal("Lifesteal UI feature %s is now %s".formatted(
                feature,
                enabled ? "on" : "off"
        )), true);
        return 1;
    }

    private int setUiSound(ServerCommandSource source, String type, String sound) {
        if (!uiSettings.setSound(type, sound)) {
            source.sendError(Text.literal("Unknown UI sound type: " + type));
            return 0;
        }
        source.sendFeedback(() -> Text.literal("Lifesteal UI sound %s is now %s".formatted(type, sound)), true);
        return 1;
    }

    private int prefixList(ServerCommandSource source) {
        source.sendFeedback(() -> Text.literal("Lifesteal prefixes: " + uiSettings.prefixRolesText()), false);
        return 1;
    }

    private int setPrefixRole(ServerCommandSource source, String role, String playerName, boolean enabled) {
        if (!uiSettings.setPrefixRole(role, playerName, enabled)) {
            source.sendError(Text.literal("Unknown prefix role: " + role));
            return 0;
        }
        source.sendFeedback(() -> Text.literal("%s %s %s prefix.".formatted(
                playerName,
                enabled ? "added to" : "removed from",
                role
        )), true);
        return 1;
    }

    private int withdraw(ServerCommandSource source, int amount) throws CommandSyntaxException {
        ServerPlayerEntity player = source.getPlayerOrThrow();
        PlayerHeartState state = heartService.ensurePlayer(player.getUuid());
        if (state.eliminated()) {
            source.sendError(Text.literal("Eliminated players cannot withdraw hearts."));
            return 0;
        }
        if (state.hearts() - amount < 1) {
            source.sendError(Text.literal("You must keep at least 1 heart."));
            return 0;
        }

        HeartChangeResult result = heartService.removeHearts(player.getUuid(), amount, HeartChangeReason.WITHDRAW);
        playerHeartApplier.applyHearts(player, result.newHearts());
        giveHeartItems(player, amount);
        auditLog.log("withdraw", "%s (%s) withdrew %d heart(s): %d -> %d".formatted(
                player.getName().getString(),
                player.getUuidAsString(),
                amount,
                result.previousHearts(),
                result.newHearts()
        ));
        source.sendFeedback(() -> Text.literal("Withdrew %d heart%s. You now have %d hearts.".formatted(
                amount,
                amount == 1 ? "" : "s",
                result.newHearts()
        )), false);
        return amount;
    }

    private void giveHeartItems(ServerPlayerEntity player, int amount) {
        int remaining = amount;
        while (remaining > 0) {
            int stackSize = Math.min(remaining, modItems.heart().getMaxCount());
            player.giveOrDropStack(new ItemStack(modItems.heart(), stackSize));
            remaining -= stackSize;
        }
    }

    private enum HeartCommandMode {
        SET,
        ADD,
        REMOVE
    }
}
