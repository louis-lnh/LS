package com.shd.lifesteal.impl;

import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.PlayerConfigEntry;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class PlayerConnectionHooks {
    private static final Text ELIMINATED_MESSAGE = Text.translatable("text.shd-lifesteal.eliminated");

    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;

    public PlayerConnectionHooks(HeartService heartService, PlayerHeartApplier playerHeartApplier) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
    }

    public void register() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            heartService.ensurePlayer(player.getUuid());
            if (heartService.isEliminated(player.getUuid()) && !isAdminBypass(server, player)) {
                handler.disconnect(ELIMINATED_MESSAGE);
                return;
            }
            playerHeartApplier.applyStoredHearts(player);
        });
    }

    private boolean isAdminBypass(MinecraftServer server, ServerPlayerEntity player) {
        return server.getPlayerManager().isOperator(new PlayerConfigEntry(player.getGameProfile()));
    }
}
