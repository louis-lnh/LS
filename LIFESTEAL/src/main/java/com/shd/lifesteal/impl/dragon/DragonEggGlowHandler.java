package com.shd.lifesteal.impl.dragon;

import com.shd.lifesteal.impl.config.LifestealConfig;
import com.shd.lifesteal.impl.objective.PlayerObjectiveInventoryScanner;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.Items;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public final class DragonEggGlowHandler {
    private final LifestealConfig config;
    private final Map<UUID, Instant> glowExpiresAt = new HashMap<>();
    private final Set<UUID> lastCarrying = new HashSet<>();

    public DragonEggGlowHandler(LifestealConfig config) {
        this.config = config;
    }

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            UUID playerId = handler.getPlayer().getUuid();
            lastCarrying.remove(playerId);
            glowExpiresAt.remove(playerId);
        });
    }

    public Optional<Instant> glowExpiresAt(UUID playerId) {
        return Optional.ofNullable(glowExpiresAt.get(playerId))
                .filter(expiresAt -> expiresAt.isAfter(Instant.now()));
    }

    private void tick(MinecraftServer server) {
        Instant now = Instant.now();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            UUID playerId = player.getUuid();
            boolean carrying = carriesDragonEgg(player);
            boolean wasCarrying = lastCarrying.contains(playerId);

            Instant expiresAt = glowExpiresAt.get(playerId);
            if (carrying && !wasCarrying) {
                glowExpiresAt.put(playerId, now.plus(config.dragonEggGlowDuration()));
                expiresAt = glowExpiresAt.get(playerId);
            }

            if (carrying) {
                lastCarrying.add(playerId);
            } else {
                lastCarrying.remove(playerId);
                glowExpiresAt.remove(playerId);
            }

            if (expiresAt != null && !carrying) {
                player.removeStatusEffect(StatusEffects.GLOWING);
            } else if (expiresAt != null && expiresAt.isAfter(now)) {
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.GLOWING, remainingTicks(now, expiresAt), 0, true, false, true));
            } else if (expiresAt != null) {
                player.removeStatusEffect(StatusEffects.GLOWING);
                glowExpiresAt.remove(playerId);
            }
        }
    }

    private boolean carriesDragonEgg(ServerPlayerEntity player) {
        return PlayerObjectiveInventoryScanner.carries(player, Items.DRAGON_EGG);
    }

    private int remainingTicks(Instant now, Instant expiresAt) {
        long seconds = Math.max(1L, expiresAt.getEpochSecond() - now.getEpochSecond() + 1L);
        long ticks = seconds * 20L;
        return (int) Math.min(Integer.MAX_VALUE, ticks);
    }

}
