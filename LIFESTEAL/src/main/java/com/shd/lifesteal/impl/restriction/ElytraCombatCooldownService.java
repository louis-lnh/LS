package com.shd.lifesteal.impl.restriction;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public final class ElytraCombatCooldownService {
    private static final int COOLDOWN_TICKS = 90 * 20;
    private static final Duration COOLDOWN_DURATION = Duration.ofSeconds(90);
    private static final Duration RECENT_MOBILITY_DURATION = Duration.ofSeconds(12);
    private static final ItemStack ELYTRA_STACK = new ItemStack(Items.ELYTRA);
    private static final ItemStack ENDER_PEARL_STACK = new ItemStack(Items.ENDER_PEARL);
    private static final ItemStack TRIDENT_STACK = new ItemStack(Items.TRIDENT);
    private static final ItemStack DIAMOND_SPEAR_STACK = new ItemStack(Items.DIAMOND_SPEAR);
    private static final ItemStack NETHERITE_SPEAR_STACK = new ItemStack(Items.NETHERITE_SPEAR);
    private final Map<UUID, Instant> cooldowns = new ConcurrentHashMap<>();
    private final Map<UUID, Instant> recentGliding = new ConcurrentHashMap<>();
    private final Map<UUID, Instant> recentFastFall = new ConcurrentHashMap<>();

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    public void apply(ServerPlayerEntity player, boolean spearCombatBan, Instant now) {
        cooldowns.put(player.getUuid(), now.plus(COOLDOWN_DURATION));
        player.getItemCooldownManager().set(ELYTRA_STACK, COOLDOWN_TICKS);
        player.getItemCooldownManager().set(ENDER_PEARL_STACK, COOLDOWN_TICKS);
        player.getItemCooldownManager().set(TRIDENT_STACK, COOLDOWN_TICKS);
        if (spearCombatBan) {
            player.getItemCooldownManager().set(DIAMOND_SPEAR_STACK, COOLDOWN_TICKS);
            player.getItemCooldownManager().set(NETHERITE_SPEAR_STACK, COOLDOWN_TICKS);
        }
    }

    public boolean isActive(UUID playerId, Instant now) {
        return snapshot(playerId, now).isPresent();
    }

    public Optional<Snapshot> snapshot(UUID playerId, Instant now) {
        Instant expiresAt = cooldowns.get(playerId);
        if (expiresAt == null) {
            return Optional.empty();
        }

        if (!expiresAt.isAfter(now)) {
            cooldowns.remove(playerId, expiresAt);
            return Optional.empty();
        }

        long remainingSeconds = Math.max(1L, Duration.between(now, expiresAt).toSeconds());
        return Optional.of(new Snapshot(playerId, (int) remainingSeconds));
    }

    public MobilitySnapshot mobilitySnapshot(UUID playerId, Instant now) {
        boolean gliding = active(recentGliding, playerId, now);
        boolean fastFall = active(recentFastFall, playerId, now);
        return new MobilitySnapshot(playerId, gliding, fastFall);
    }

    private void tick(MinecraftServer server) {
        Instant now = Instant.now();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            if (player.isGliding()) {
                recentGliding.put(player.getUuid(), now.plus(RECENT_MOBILITY_DURATION));
            }
            if (!player.isOnGround() && player.fallDistance >= 4.0F && player.getVelocity().y < -0.65D) {
                recentFastFall.put(player.getUuid(), now.plus(RECENT_MOBILITY_DURATION));
            }
        }
        recentGliding.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
        recentFastFall.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
    }

    private boolean active(Map<UUID, Instant> values, UUID playerId, Instant now) {
        Instant expiresAt = values.get(playerId);
        if (expiresAt == null) {
            return false;
        }
        if (!expiresAt.isAfter(now)) {
            values.remove(playerId, expiresAt);
            return false;
        }
        return true;
    }

    public record Snapshot(UUID playerId, int remainingSeconds) {
    }

    public record MobilitySnapshot(UUID playerId, boolean recentlyGliding, boolean recentlyFastFalling) {
    }
}
