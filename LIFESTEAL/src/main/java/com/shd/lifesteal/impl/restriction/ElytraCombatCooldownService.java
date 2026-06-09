package com.shd.lifesteal.impl.restriction;

import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.server.network.ServerPlayerEntity;

public final class ElytraCombatCooldownService {
    private static final int COOLDOWN_TICKS = 90 * 20;
    private static final ItemStack ELYTRA_STACK = new ItemStack(Items.ELYTRA);

    public void apply(ServerPlayerEntity player) {
        player.getItemCooldownManager().set(ELYTRA_STACK, COOLDOWN_TICKS);
    }
}
