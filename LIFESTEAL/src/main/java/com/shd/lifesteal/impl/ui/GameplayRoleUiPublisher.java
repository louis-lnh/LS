package com.shd.lifesteal.impl.ui;

import com.shd.lifesteal.api.GameplayRoleSnapshot;
import com.shd.lifesteal.impl.heart.HeartService;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public final class GameplayRoleUiPublisher {
    private static final int PUBLISH_INTERVAL_TICKS = 20;
    private static final int APPROXIMATE_COORDINATE_STEP = 100;

    private final HeartService heartService;
    private final UiBridgeManager uiBridgeManager;
    private final Map<UUID, GameplayRoleSnapshot> lastSnapshots = new HashMap<>();
    private final Set<UUID> lastOnlinePlayers = new HashSet<>();
    private long ticks;

    public GameplayRoleUiPublisher(HeartService heartService, UiBridgeManager uiBridgeManager) {
        this.heartService = heartService;
        this.uiBridgeManager = uiBridgeManager;
    }

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    private void tick(MinecraftServer server) {
        ticks++;
        if (ticks % PUBLISH_INTERVAL_TICKS != 0L) {
            return;
        }

        Set<UUID> onlinePlayers = onlinePlayers(server);
        for (GameplayRoleSnapshot snapshot : heartService.gameplayRoles(server)) {
            GameplayRoleSnapshot previous = lastSnapshots.put(snapshot.playerId(), snapshot);
            if (!snapshot.equals(previous)) {
                uiBridgeManager.onGameplayRoleChanged(snapshot);
                publishMilestones(server, previous, snapshot, lastOnlinePlayers.contains(snapshot.playerId()));
            }
        }
        lastOnlinePlayers.clear();
        lastOnlinePlayers.addAll(onlinePlayers);
    }

    private void publishMilestones(MinecraftServer server, GameplayRoleSnapshot previous, GameplayRoleSnapshot current, boolean wasOnline) {
        if (previous == null || !wasOnline) {
            return;
        }

        String playerName = UiNotifier.playerName(server, current.playerId());
        if (!previous.twentyHearts() && current.twentyHearts()) {
            UiNotifier.gameplayEvent(uiBridgeManager, server, "milestone_20_hearts", playerName + " reached 20 Hearts", current.playerId(), null);
        }

        if (!previous.dragonEggHolder() && current.dragonEggHolder()) {
            UiNotifier.gameplayEvent(uiBridgeManager, server, "milestone_dragon_egg", dragonEggMessage(server, current.playerId(), playerName), current.playerId(), null);
        }

    }

    private String dragonEggMessage(MinecraftServer server, UUID playerId, String playerName) {
        ServerPlayerEntity player = server.getPlayerManager().getPlayer(playerId);
        if (player == null) {
            return playerName + " picked up the Dragon Egg";
        }

        return playerName + " picked up the Dragon Egg near %d %d in %s".formatted(
                approximate(player.getBlockPos().getX()),
                approximate(player.getBlockPos().getZ()),
                worldName(player.getEntityWorld().getRegistryKey().getValue().toString())
        );
    }

    private int approximate(int coordinate) {
        return Math.round((float) coordinate / APPROXIMATE_COORDINATE_STEP) * APPROXIMATE_COORDINATE_STEP;
    }

    private Set<UUID> onlinePlayers(MinecraftServer server) {
        Set<UUID> onlinePlayers = new HashSet<>();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            onlinePlayers.add(player.getUuid());
        }
        return onlinePlayers;
    }

    private String worldName(String world) {
        return switch (world) {
            case "minecraft:overworld" -> "Overworld";
            case "minecraft:the_nether" -> "Nether";
            case "minecraft:the_end" -> "End";
            default -> world;
        };
    }
}
