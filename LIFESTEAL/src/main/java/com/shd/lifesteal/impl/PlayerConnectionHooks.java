package com.shd.lifesteal.impl;

import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.elimination.EliminatedPlayerAccess;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PlayerConnectionHooks {
    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;
    private final EliminatedPlayerAccess eliminatedPlayerAccess;

    public PlayerConnectionHooks(
            HeartService heartService,
            PlayerHeartApplier playerHeartApplier,
            EliminatedPlayerAccess eliminatedPlayerAccess
    ) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
        this.eliminatedPlayerAccess = eliminatedPlayerAccess;
    }

    public void register() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            heartService.ensurePlayer(player.getUuid());
            if (eliminatedPlayerAccess.disconnectIfEliminated(player)) {
                return;
            }
            playerHeartApplier.applyStoredHearts(player);
        });
    }
}
