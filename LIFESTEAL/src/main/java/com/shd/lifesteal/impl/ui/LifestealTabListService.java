package com.shd.lifesteal.impl.ui;

import com.shd.lifesteal.api.GameplayRoleSnapshot;
import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.api.ui.DragonEggLocationKind;
import com.shd.lifesteal.api.ui.DragonEggUiState;
import com.shd.lifesteal.impl.dragon.DragonEggBeaconEffectHandler;
import com.shd.lifesteal.impl.event.EventTimerService;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.objective.PlayerObjectiveInventoryScanner;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.item.Items;
import net.minecraft.network.packet.s2c.play.PlayerListHeaderS2CPacket;
import net.minecraft.scoreboard.AbstractTeam;
import net.minecraft.scoreboard.ServerScoreboard;
import net.minecraft.scoreboard.Team;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class LifestealTabListService {
    private static final long UPDATE_INTERVAL_TICKS = 10L;
    private static final String TEAM_PREFIX = "shd_ls_";

    private final HeartService heartService;
    private final GracePeriodService gracePeriodService;
    private final EventTimerService eventTimerService;
    private final DragonEggBeaconEffectHandler dragonEggBeaconEffectHandler;
    private final LifestealUiSettings uiSettings;
    private final Map<UUID, String> assignedTeams = new HashMap<>();
    private long ticks;

    public LifestealTabListService(
            HeartService heartService,
            GracePeriodService gracePeriodService,
            EventTimerService eventTimerService,
            DragonEggBeaconEffectHandler dragonEggBeaconEffectHandler,
            LifestealUiSettings uiSettings
    ) {
        this.heartService = heartService;
        this.gracePeriodService = gracePeriodService;
        this.eventTimerService = eventTimerService;
        this.dragonEggBeaconEffectHandler = dragonEggBeaconEffectHandler;
        this.uiSettings = uiSettings;
    }

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    private void tick(MinecraftServer server) {
        ticks++;
        if (ticks % UPDATE_INTERVAL_TICKS != 0L) {
            return;
        }

        if (!uiSettings.enabled(LifestealUiSettings.TAB)) {
            clear(server);
            return;
        }

        Map<UUID, GameplayRoleSnapshot> roles = roles(server);
        updateHeaderFooter(server);
        updateTeams(server, roles);
    }

    private void updateHeaderFooter(MinecraftServer server) {
        GracePeriodSnapshot grace = gracePeriodService.snapshot();
        EventTimerService.Snapshot event = eventTimerService.snapshot();
        String phase = event.active()
                ? (event.paused() ? event.name() + " Paused " : event.name() + " ") + TimeText.compact(event.remaining())
                : grace.active()
                ? (grace.paused() ? "Grace Paused " : "Grace ") + TimeText.compact(grace.remaining())
                : "Season Active";
        String egg = dragonEggText(server);
        int online = server.getPlayerManager().getCurrentPlayerCount();
        int max = server.getMaxPlayerCount();
        int staff = staffCount(server);

        Text header = Text.literal(uiSettings.tabTitle()).formatted(Formatting.GOLD, Formatting.BOLD)
                .append(Text.literal("\n" + phase).formatted(Formatting.AQUA));
        if (!egg.isBlank()) {
            header = header.copy().append(Text.literal("\n" + egg).formatted(Formatting.LIGHT_PURPLE));
        }

        Text footer = Text.literal("%d/%d online".formatted(online, max)).formatted(Formatting.GRAY)
                .append(Text.literal(" | Staff: " + staff).formatted(Formatting.DARK_AQUA))
                .append(Text.literal("\n" + uiSettings.tabSeason()).formatted(Formatting.YELLOW));
        if (!uiSettings.tabAd().isBlank()) {
            footer = footer.copy().append(Text.literal("\n" + uiSettings.tabAd()).formatted(Formatting.GOLD));
        }

        PlayerListHeaderS2CPacket packet = new PlayerListHeaderS2CPacket(header, footer);
        server.getPlayerManager().getPlayerList().forEach(player -> player.networkHandler.sendPacket(packet));
    }

    private void updateTeams(MinecraftServer server, Map<UUID, GameplayRoleSnapshot> roles) {
        ServerScoreboard scoreboard = server.getScoreboard();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            GameplayRoleSnapshot role = roles.get(player.getUuid());
            if (role == null) {
                continue;
            }

            Team team = team(scoreboard, teamName(player, role));
            team.setPrefix(prefix(server, player, role));
            team.setSuffix(Text.literal(" \u2665 " + role.hearts()).formatted(Formatting.RED));
            team.setColor(color(server, player, role));
            team.setNameTagVisibilityRule(AbstractTeam.VisibilityRule.ALWAYS);
            team.setCollisionRule(AbstractTeam.CollisionRule.ALWAYS);

            String scoreHolder = player.getNameForScoreboard();
            String previousTeam = assignedTeams.put(player.getUuid(), team.getName());
            if (previousTeam != null && !previousTeam.equals(team.getName())) {
                Team previous = scoreboard.getTeam(previousTeam);
                if (previous != null) {
                    scoreboard.removeScoreHolderFromTeam(scoreHolder, previous);
                }
            }
            scoreboard.addScoreHolderToTeam(scoreHolder, team);
        }
    }

    private Team team(ServerScoreboard scoreboard, String name) {
        Team team = scoreboard.getTeam(name);
        if (team != null) {
            return team;
        }
        return scoreboard.addTeam(name);
    }

    private MutableText prefix(MinecraftServer server, ServerPlayerEntity player, GameplayRoleSnapshot role) {
        MutableText text = Text.empty();
        String staffRole = staffRole(server, player);
        if (!staffRole.isBlank()) {
            text.append(tag(staffRole.toUpperCase(), colorForStaffRole(staffRole)));
        }
        if (role.maceWielder()) {
            text.append(tag("MACE", Formatting.DARK_RED));
        }
        if (role.dragonEggHolder()) {
            text.append(tag("EGG", Formatting.LIGHT_PURPLE));
        }
        return text;
    }

    private MutableText tag(String label, Formatting color) {
        return Text.literal("[" + label + "] ").formatted(color);
    }

    private Formatting color(MinecraftServer server, ServerPlayerEntity player, GameplayRoleSnapshot role) {
        String staffRole = staffRole(server, player);
        if (!staffRole.isBlank()) {
            return colorForStaffRole(staffRole);
        }
        if (role.maceWielder()) {
            return Formatting.DARK_RED;
        }
        if (role.dragonEggHolder()) {
            return Formatting.LIGHT_PURPLE;
        }
        return Formatting.WHITE;
    }

    private String staffRole(MinecraftServer server, ServerPlayerEntity player) {
        return uiSettings.staffRole(player.getName().getString());
    }

    private Formatting colorForStaffRole(String staffRole) {
        return switch (staffRole) {
            case "Owner" -> Formatting.GOLD;
            case "SHD Team" -> Formatting.AQUA;
            case "Mod" -> Formatting.GREEN;
            default -> Formatting.RED;
        };
    }

    private String teamName(ServerPlayerEntity player, GameplayRoleSnapshot role) {
        String tier;
        if (!staffRole(player.getEntityWorld().getServer(), player).isBlank()) {
            tier = "01";
        } else if (role.maceWielder()) {
            tier = "05";
        } else if (role.dragonEggHolder()) {
            tier = "06";
        } else {
            tier = "09";
        }
        return (TEAM_PREFIX + tier + "_" + player.getUuidAsString().substring(0, 6)).substring(0, 16);
    }

    private Map<UUID, GameplayRoleSnapshot> roles(MinecraftServer server) {
        Map<UUID, GameplayRoleSnapshot> roles = new HashMap<>();
        heartService.gameplayRoles(server).forEach(role -> roles.put(role.playerId(), role));
        return roles;
    }

    private String dragonEggText(MinecraftServer server) {
        DragonEggUiState egg = dragonEggBeaconEffectHandler.currentUiState();
        if (egg.kind() == DragonEggLocationKind.PLACED) {
            return "Dragon Egg at %d %d %d in %s".formatted(egg.x(), egg.y(), egg.z(), worldName(egg.world()));
        }
        if (egg.kind() == DragonEggLocationKind.CARRIED) {
            return dragonEggCarrier(server);
        }
        return "";
    }

    private String dragonEggCarrier(MinecraftServer server) {
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            if (PlayerObjectiveInventoryScanner.carries(player, Items.DRAGON_EGG)) {
                return "Dragon Egg carried by " + player.getName().getString();
            }
        }
        return "";
    }

    private String worldName(String world) {
        return switch (world) {
            case "minecraft:overworld" -> "Overworld";
            case "minecraft:the_nether" -> "Nether";
            case "minecraft:the_end" -> "End";
            default -> world;
        };
    }

    private int staffCount(MinecraftServer server) {
        int count = 0;
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            if (!staffRole(server, player).isBlank()) {
                count++;
            }
        }
        return count;
    }

    private void clear(MinecraftServer server) {
        ServerScoreboard scoreboard = server.getScoreboard();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            String teamName = assignedTeams.remove(player.getUuid());
            if (teamName == null) {
                continue;
            }
            Team team = scoreboard.getTeam(teamName);
            if (team != null) {
                scoreboard.removeScoreHolderFromTeam(player.getNameForScoreboard(), team);
            }
            player.networkHandler.sendPacket(new PlayerListHeaderS2CPacket(Text.empty(), Text.empty()));
        }
    }

}
