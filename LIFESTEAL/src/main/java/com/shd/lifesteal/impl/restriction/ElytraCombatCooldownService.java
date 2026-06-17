package com.shd.lifesteal.impl.restriction;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.server.network.ServerPlayerEntity;

public final class ElytraCombatCooldownService {
    private static final int COOLDOWN_TICKS = 90 * 20;
    private static final Duration COOLDOWN_DURATION = Duration.ofSeconds(90);
    private static final ItemStack ELYTRA_STACK = new ItemStack(Items.ELYTRA);
    private static final ItemStack ENDER_PEARL_STACK = new ItemStack(Items.ENDER_PEARL);
    private static final ItemStack TRIDENT_STACK = new ItemStack(Items.TRIDENT);
    private static final ItemStack DIAMOND_SPEAR_STACK = new ItemStack(Items.DIAMOND_SPEAR);
    private static final ItemStack NETHERITE_SPEAR_STACK = new ItemStack(Items.NETHERITE_SPEAR);
    private final Map<UUID, Instant> cooldowns = new ConcurrentHashMap<>();

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

    public record Snapshot(UUID playerId, int remainingSeconds) {
    }
}
