package com.shd.lifesteal.impl.player;

import com.shd.lifesteal.impl.heart.HeartService;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PlayerPlaytimeTracker {
    private final HeartService heartService;
    private long ticks;

    public PlayerPlaytimeTracker(HeartService heartService) {
        this.heartService = heartService;
    }

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    private void tick(MinecraftServer server) {
        ticks++;
        if (ticks % 20L != 0L) {
            return;
        }

        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            heartService.addPlaytime(player.getUuid(), 1L);
        }
    }
}
