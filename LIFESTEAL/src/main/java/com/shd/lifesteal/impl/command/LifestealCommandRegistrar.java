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
import com.shd.lifesteal.impl.anticheat.AntiCheatAction;
import com.shd.lifesteal.impl.anticheat.AntiCheatCaseStatus;
import com.shd.lifesteal.impl.anticheat.AntiCheatCategory;
import com.shd.lifesteal.impl.anticheat.AntiCheatDetection;
import com.shd.lifesteal.impl.anticheat.AntiCheatRecord;
import com.shd.lifesteal.impl.anticheat.AntiCheatService;
import com.shd.lifesteal.impl.anticheat.AntiCheatSeverity;
import com.shd.lifesteal.impl.audit.LifestealAuditLog;
import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.combat.CombatTagSnapshot;
import com.shd.lifesteal.impl.config.LifestealRuleSettings;
import com.shd.lifesteal.impl.event.EventTimerService;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.item.ModItems;
import com.shd.lifesteal.impl.player.ResolvedPlayer;
import com.shd.lifesteal.impl.player.WhitelistPlayerResolver;
import com.shd.lifesteal.impl.player.WhitelistedPlayerArgumentType;
import com.shd.lifesteal.impl.revival.RevivalService;
import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import com.shd.lifesteal.impl.ui.LifestealSoundService;
import com.shd.lifesteal.impl.ui.LifestealUiSettings;
import com.shd.lifesteal.impl.ui.TimeText;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import net.minecraft.command.CommandSource;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.item.ItemStack;
import net.minecraft.server.BannedPlayerEntry;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.PlayerConfigEntry;
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
    private final LifestealRuleSettings ruleSettings;
    private final LifestealUiSettings uiSettings;
    private final LifestealSoundService soundService;
    private final LifestealAuditLog auditLog;
    private final AntiCheatService antiCheatService;
    private final RevivalService revivalService;

    public LifestealCommandRegistrar(
            HeartService heartService,
            PlayerHeartApplier playerHeartApplier,
            ModItems modItems,
            WhitelistPlayerResolver playerResolver,
            CombatTagService combatTagService,
            GracePeriodService gracePeriodService,
            EventTimerService eventTimerService,
            LifestealRuleSettings ruleSettings,
            LifestealUiSettings uiSettings,
            LifestealSoundService soundService,
            LifestealAuditLog auditLog,
            AntiCheatService antiCheatService,
            RevivalService revivalService
    ) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
        this.modItems = modItems;
        this.playerResolver = playerResolver;
        this.combatTagService = combatTagService;
        this.gracePeriodService = gracePeriodService;
        this.eventTimerService = eventTimerService;
        this.ruleSettings = ruleSettings;
        this.uiSettings = uiSettings;
        this.soundService = soundService;
        this.auditLog = auditLog;
        this.antiCheatService = antiCheatService;
        this.revivalService = revivalService;
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
                .then(CommandManager.literal("rules")
                        .then(CommandManager.literal("status")
                                .executes(context -> rulesStatus(context.getSource()))))
                .then(CommandManager.literal("anticheat")
                        .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                        .then(CommandManager.literal("status")
                                .executes(context -> antiCheatStatus(context.getSource())))
                        .then(CommandManager.literal("reload")
                                .executes(context -> antiCheatReload(context.getSource())))
                        .then(CommandManager.literal("clear")
                                .executes(context -> antiCheatClear(context.getSource())))
                        .then(CommandManager.literal("open")
                                .executes(context -> antiCheatOpen(context.getSource(), 10))
                                .then(CommandManager.argument("limit", IntegerArgumentType.integer(1, 25))
                                        .executes(context -> antiCheatOpen(
                                                context.getSource(),
                                                IntegerArgumentType.getInteger(context, "limit")
                                        ))))
                        .then(CommandManager.literal("mark")
                                .then(CommandManager.argument("id", StringArgumentType.word())
                                        .then(CommandManager.argument("status", StringArgumentType.word())
                                                .suggests((context, builder) -> CommandSource.suggestMatching(
                                                        AntiCheatCaseStatus.suggestions(),
                                                        builder
                                                ))
                                                .executes(context -> antiCheatMark(
                                                        context.getSource(),
                                                        StringArgumentType.getString(context, "id"),
                                                        StringArgumentType.getString(context, "status"),
                                                        ""
                                                ))
                                                .then(CommandManager.argument("note", StringArgumentType.greedyString())
                                                        .executes(context -> antiCheatMark(
                                                                context.getSource(),
                                                                StringArgumentType.getString(context, "id"),
                                                                StringArgumentType.getString(context, "status"),
                                                                StringArgumentType.getString(context, "note")
                                                        ))))))
                        .then(CommandManager.literal("note")
                                .then(CommandManager.argument("id", StringArgumentType.word())
                                        .then(CommandManager.argument("note", StringArgumentType.greedyString())
                                                .executes(context -> antiCheatNote(
                                                        context.getSource(),
                                                        StringArgumentType.getString(context, "id"),
                                                        StringArgumentType.getString(context, "note")
                                                )))))
                        .then(CommandManager.literal("lookup")
                                .then(CommandManager.argument("id", StringArgumentType.word())
                                        .executes(context -> antiCheatLookup(
                                                context.getSource(),
                                                StringArgumentType.getString(context, "id")
                                        ))))
                        .then(CommandManager.literal("recent")
                                .executes(context -> antiCheatRecent(context.getSource(), 10))
                                .then(CommandManager.argument("limit", IntegerArgumentType.integer(1, 25))
                                        .executes(context -> antiCheatRecent(
                                                context.getSource(),
                                                IntegerArgumentType.getInteger(context, "limit")
                                        ))))
                        .then(CommandManager.literal("player")
                                .then(playerArgument("player")
                                        .executes(context -> antiCheatPlayer(
                                                context.getSource(),
                                                WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                10
                                        ))
                                        .then(CommandManager.argument("limit", IntegerArgumentType.integer(1, 25))
                                                .executes(context -> antiCheatPlayer(
                                                        context.getSource(),
                                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                        IntegerArgumentType.getInteger(context, "limit")
                                                )))))
                        .then(CommandManager.literal("ingest")
                                .then(playerArgument("player")
                                        .then(CommandManager.argument("source", StringArgumentType.word())
                                                .then(CommandManager.argument("check", StringArgumentType.word())
                                                        .then(CommandManager.argument("violations", IntegerArgumentType.integer(1))
                                                                .then(CommandManager.argument("action", StringArgumentType.word())
                                                                        .suggests((context, builder) -> CommandSource.suggestMatching(
                                                                                java.util.Arrays.stream(AntiCheatAction.values()).map(Enum::name).toList(),
                                                                                builder
                                                                        ))
                                                                        .executes(context -> antiCheatIngest(
                                                                                context.getSource(),
                                                                                WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                                                StringArgumentType.getString(context, "source"),
                                                                                StringArgumentType.getString(context, "check"),
                                                                                IntegerArgumentType.getInteger(context, "violations"),
                                                                                StringArgumentType.getString(context, "action"),
                                                                                ""
                                                                        ))
                                                                        .then(CommandManager.argument("details", StringArgumentType.greedyString())
                                                                                .executes(context -> antiCheatIngest(
                                                                                        context.getSource(),
                                                                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                                                        StringArgumentType.getString(context, "source"),
                                                                                        StringArgumentType.getString(context, "check"),
                                                                                        IntegerArgumentType.getInteger(context, "violations"),
                                                                                        StringArgumentType.getString(context, "action"),
                                                                                        StringArgumentType.getString(context, "details")
                                                                                ))))))))))
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
        dispatcher.register(CommandManager.literal("tempban")
                .requires(CommandManager.requirePermissionLevel(CommandManager.GAMEMASTERS_CHECK))
                .then(playerArgument("player")
                        .then(CommandManager.argument("duration", StringArgumentType.word())
                                .executes(context -> tempBan(
                                        context.getSource(),
                                        WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                        StringArgumentType.getString(context, "duration"),
                                        "Temporarily suspended by staff"
                                ))
                                .then(CommandManager.argument("reason", StringArgumentType.greedyString())
                                        .executes(context -> tempBan(
                                                context.getSource(),
                                                WhitelistedPlayerArgumentType.getPlayer(context, "player", playerResolver),
                                                StringArgumentType.getString(context, "duration"),
                                                StringArgumentType.getString(context, "reason")
                                        ))))));
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

    private int tempBan(ServerCommandSource source, ResolvedPlayer player, String durationInput, String reason) {
        Duration duration = parseTempBanDuration(durationInput);
        if (duration == null) {
            source.sendError(Text.literal("Invalid tempban duration. Use values like 30m, 12h, 7d, or 1w."));
            return 0;
        }

        Instant now = Instant.now();
        Instant expiresAt = now.plus(duration);
        String cleanReason = cleanBanReason(reason);
        PlayerConfigEntry entry = new PlayerConfigEntry(player.playerId(), player.name());
        BannedPlayerEntry ban = new BannedPlayerEntry(
                entry,
                Date.from(now),
                source.getName(),
                Date.from(expiresAt),
                cleanReason
        );
        source.getServer().getPlayerManager().getUserBanList().add(ban);
        player.onlinePlayer().ifPresent(onlinePlayer -> onlinePlayer.networkHandler.disconnect(Text.literal(
                "You are temporarily suspended from playing on this server\nReason: %s\nSuspension ends: %s".formatted(cleanReason, expiresAt)
        )));
        auditLog.log("tempban", "player=%s uuid=%s duration=%s expires=%s source=%s reason=%s".formatted(
                player.name(),
                player.playerId(),
                durationInput,
                expiresAt,
                source.getName(),
                cleanReason
        ));
        source.sendFeedback(() -> Text.literal("Temporarily banned %s for %s until %s.".formatted(
                player.name(),
                durationInput,
                expiresAt
        )), true);
        return 1;
    }

    private Duration parseTempBanDuration(String input) {
        if (input == null || input.length() < 2) {
            return null;
        }
        String trimmed = input.trim().toLowerCase(java.util.Locale.ROOT);
        char unit = trimmed.charAt(trimmed.length() - 1);
        long amount;
        try {
            amount = Long.parseLong(trimmed.substring(0, trimmed.length() - 1));
        } catch (NumberFormatException exception) {
            return null;
        }
        if (amount <= 0) {
            return null;
        }
        try {
            return switch (unit) {
                case 's' -> Duration.ofSeconds(amount);
                case 'm' -> Duration.ofMinutes(amount);
                case 'h' -> Duration.ofHours(amount);
                case 'd' -> Duration.ofDays(amount);
                case 'w' -> Duration.ofDays(Math.multiplyExact(amount, 7L));
                default -> null;
            };
        } catch (ArithmeticException exception) {
            return null;
        }
    }

    private String cleanBanReason(String reason) {
        String clean = String.valueOf(reason == null ? "" : reason)
                .replace('\r', ' ')
                .replace('\n', ' ')
                .trim();
        if (clean.isBlank()) {
            return "Temporarily suspended by staff";
        }
        return clean.length() > 180 ? clean.substring(0, 180) : clean;
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
        RevivalService.RevivalResult result = revivalService.reviveByStaff(
                source.getServer(),
                player.playerId(),
                player.name(),
                source.getName()
        );
        if (!result.revived()) {
            source.sendError(Text.literal(player.name() + " is not eliminated."));
            return 0;
        }
        String onlineSuffix = player.online() ? "" : " (offline, applies on next join)";
        source.sendFeedback(() -> Text.literal("%s revived with %d hearts%s".formatted(
                player.name(),
                result.hearts(),
                onlineSuffix
        )), true);
        return result.hearts();
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

    private int rulesStatus(ServerCommandSource source) {
        source.sendFeedback(() -> Text.literal("Lifesteal rules: " + ruleSettings.statusText()), false);
        return 1;
    }

    private int antiCheatStatus(ServerCommandSource source) {
        source.sendFeedback(() -> Text.literal("SHD anti-cheat: " + antiCheatService.statusText()), false);
        return 1;
    }

    private int antiCheatReload(ServerCommandSource source) {
        antiCheatService.reload();
        source.sendFeedback(() -> Text.literal("Reloaded SHD anti-cheat config: " + antiCheatService.statusText()), true);
        return 1;
    }

    private int antiCheatClear(ServerCommandSource source) {
        antiCheatService.clearHistory();
        source.sendFeedback(() -> Text.literal("Cleared loaded anti-cheat alert history. Persisted evidence files were left intact."), true);
        return 1;
    }

    private int antiCheatOpen(ServerCommandSource source, int limit) {
        java.util.List<AntiCheatRecord> records = antiCheatService.openRecords(limit);
        if (records.isEmpty()) {
            source.sendFeedback(() -> Text.literal("No unresolved anti-cheat cases."), false);
            return 0;
        }
        source.sendFeedback(() -> Text.literal("Unresolved anti-cheat cases:"), false);
        for (AntiCheatRecord record : records) {
            source.sendFeedback(() -> Text.literal(record.compactSummary()), false);
        }
        return records.size();
    }

    private int antiCheatMark(ServerCommandSource source, String id, String status, String note) {
        AntiCheatCaseStatus parsedStatus = AntiCheatCaseStatus.parse(status, null);
        if (parsedStatus == null) {
            source.sendError(Text.literal("Unknown anti-cheat case status: " + status));
            return 0;
        }

        java.util.Optional<AntiCheatRecord> record = antiCheatService.updateCase(id, parsedStatus, source.getName(), note);
        if (record.isEmpty()) {
            source.sendError(Text.literal("No loaded anti-cheat record found for ID: " + id));
            return 0;
        }
        source.sendFeedback(() -> Text.literal("Updated anti-cheat case: " + record.get().compactSummary()), true);
        return 1;
    }

    private int antiCheatNote(ServerCommandSource source, String id, String note) {
        java.util.Optional<AntiCheatRecord> record = antiCheatService.annotateCase(id, source.getName(), note);
        if (record.isEmpty()) {
            source.sendError(Text.literal("No loaded anti-cheat record found for ID: " + id));
            return 0;
        }
        source.sendFeedback(() -> Text.literal("Updated anti-cheat case note: " + record.get().compactSummary()), true);
        return 1;
    }

    private int antiCheatLookup(ServerCommandSource source, String id) {
        java.util.Optional<AntiCheatRecord> record = antiCheatService.findRecord(id);
        if (record.isEmpty()) {
            source.sendError(Text.literal("No loaded anti-cheat record found for ID: " + id));
            return 0;
        }
        source.sendFeedback(() -> Text.literal(record.get().detailedSummary()), false);
        return 1;
    }

    private int antiCheatRecent(ServerCommandSource source, int limit) {
        java.util.List<AntiCheatRecord> records = antiCheatService.recentRecords(limit);
        if (records.isEmpty()) {
            source.sendFeedback(() -> Text.literal("No recent anti-cheat alerts."), false);
            return 0;
        }
        source.sendFeedback(() -> Text.literal("Recent anti-cheat alerts:"), false);
        for (AntiCheatRecord record : records) {
            source.sendFeedback(() -> Text.literal(record.compactSummary()), false);
        }
        return records.size();
    }

    private int antiCheatPlayer(ServerCommandSource source, ResolvedPlayer player, int limit) {
        java.util.List<AntiCheatRecord> records = antiCheatService.recentRecords(player.playerId(), limit);
        if (records.isEmpty()) {
            source.sendFeedback(() -> Text.literal("No recent anti-cheat alerts for " + player.name() + "."), false);
            return 0;
        }
        source.sendFeedback(() -> Text.literal("Recent anti-cheat alerts for " + player.name() + ":"), false);
        for (AntiCheatRecord record : records) {
            source.sendFeedback(() -> Text.literal(record.compactSummary()), false);
        }
        return records.size();
    }

    private int antiCheatIngest(
            ServerCommandSource source,
            ResolvedPlayer player,
            String externalSource,
            String check,
            int violations,
            String action,
            String details
    ) {
        ServerPlayerEntity onlinePlayer = player.onlinePlayer().orElse(null);
        if (onlinePlayer == null) {
            source.sendError(Text.literal("External anti-cheat ingest requires an online player: " + player.name()));
            return 0;
        }

        AntiCheatAction requestedAction = AntiCheatAction.parse(action, null);
        if (requestedAction == null) {
            source.sendError(Text.literal("Unknown anti-cheat action: " + action));
            return 0;
        }

        boolean operator = source.getServer().getPlayerManager().isOperator(new PlayerConfigEntry(onlinePlayer.getGameProfile()));
        AntiCheatAction appliedAction = operator && requestedAction.disconnectsPlayer()
                ? AntiCheatAction.AUDIT_ONLY
                : requestedAction;
        String normalizedSource = sanitizeExternalToken(externalSource);
        String normalizedCheck = sanitizeExternalToken(check);
        AntiCheatSeverity severity = externalSeverity(appliedAction, requestedAction, violations);
        AntiCheatCategory category = externalCategory(normalizedSource);
        String reasonCode = "external_%s_%s".formatted(normalizedSource, normalizedCheck);
        String publicReason = externalPublicReason(normalizedSource, normalizedCheck, appliedAction);
        String context = "check=external_anticheat source=%s externalCheck=%s violations=%d requestedAction=%s appliedAction=%s operatorExempt=%s details=\"%s\"".formatted(
                normalizedSource,
                normalizedCheck,
                violations,
                requestedAction,
                appliedAction,
                operator && requestedAction.disconnectsPlayer(),
                cleanDetails(details)
        );

        var enforcement = antiCheatService.handle(source.getServer(), onlinePlayer, new AntiCheatDetection(
                category,
                severity,
                reasonCode,
                publicReason,
                context,
                appliedAction
        ));
        source.sendFeedback(() -> Text.literal("External anti-cheat case created: action=%s reason=%s evidence=%s appeal=%s".formatted(
                enforcement.action(),
                enforcement.reasonCode(),
                enforcement.evidenceId(),
                enforcement.appealId().isBlank() ? "none" : enforcement.appealId()
        )), true);
        return 1;
    }

    private static AntiCheatSeverity externalSeverity(AntiCheatAction appliedAction, AntiCheatAction requestedAction, int violations) {
        if (requestedAction == AntiCheatAction.PERMANENT_BAN || appliedAction == AntiCheatAction.PERMANENT_BAN) {
            return AntiCheatSeverity.CRITICAL;
        }
        if (requestedAction == AntiCheatAction.TEMP_BAN || appliedAction == AntiCheatAction.TEMP_BAN) {
            return AntiCheatSeverity.HIGH;
        }
        if (requestedAction == AntiCheatAction.KICK || appliedAction == AntiCheatAction.KICK || violations >= 40) {
            return AntiCheatSeverity.HIGH;
        }
        if (violations >= 10) {
            return AntiCheatSeverity.WARNING;
        }
        return AntiCheatSeverity.INFO;
    }

    private static AntiCheatCategory externalCategory(String source) {
        if (source.contains("grim")) {
            return AntiCheatCategory.COMBAT;
        }
        if (source.contains("xray")) {
            return AntiCheatCategory.INVENTORY;
        }
        return AntiCheatCategory.SYSTEM_CONSISTENCY;
    }

    private static String externalPublicReason(String source, String check, AntiCheatAction action) {
        String label = source.equals("grim") ? "GrimAC" : source.toUpperCase(java.util.Locale.ROOT);
        if (action == AntiCheatAction.TEMP_BAN || action == AntiCheatAction.PERMANENT_BAN || action == AntiCheatAction.KICK) {
            return "%s unfair gameplay advantage detected".formatted(label);
        }
        return "%s anti-cheat review required: %s".formatted(label, check);
    }

    private static String sanitizeExternalToken(String value) {
        String normalized = value == null ? "unknown" : value.trim().toLowerCase(java.util.Locale.ROOT);
        normalized = normalized.replaceAll("[^a-z0-9_-]", "_");
        normalized = normalized.replaceAll("_+", "_");
        if (normalized.isBlank()) {
            return "unknown";
        }
        return normalized.length() <= 48 ? normalized : normalized.substring(0, 48);
    }

    private static String cleanDetails(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String cleaned = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return cleaned.length() <= 240 ? cleaned : cleaned.substring(0, 240);
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
