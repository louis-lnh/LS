package com.shd.lifesteal.impl.restriction;

import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import com.shd.lifesteal.impl.ui.UiNotifier;
import com.shd.lifesteal.mixin.ZombieVillagerEntityInvoker;
import java.time.Instant;
import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.mob.ZombieVillagerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.ActionResult;

public final class DisabledFeatureHandler {
    private static final int MIN_ZOMBIE_VILLAGER_CONVERSION_TICKS = 3600;
    private static final int MAX_ZOMBIE_VILLAGER_CONVERSION_TICKS = 6000;

    private final CombatTagService combatTagService;
    private final UiBridgeManager uiBridgeManager;

    public DisabledFeatureHandler(CombatTagService combatTagService, UiBridgeManager uiBridgeManager) {
        this.combatTagService = combatTagService;
        this.uiBridgeManager = uiBridgeManager;
    }

    public void register() {
        UseItemCallback.EVENT.register((player, world, hand) -> {
            if (!(player instanceof ServerPlayerEntity serverPlayer)) {
                return ActionResult.PASS;
            }

            ItemStack stack = player.getStackInHand(hand);
            if (DisabledFeatureRules.isUseBlocked(stack, inCombat(serverPlayer))) {
                warn(serverPlayer, DisabledFeatureRules.blockedReason(stack, inCombat(serverPlayer)).orElse("This feature is disabled."));
                return ActionResult.FAIL;
            }

            return ActionResult.PASS;
        });

        UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> {
            if (!(player instanceof ServerPlayerEntity serverPlayer)) {
                return ActionResult.PASS;
            }

            ItemStack stack = player.getStackInHand(hand);
            if (DisabledFeatureRules.isUseBlocked(stack, inCombat(serverPlayer))) {
                warn(serverPlayer, DisabledFeatureRules.blockedReason(stack, inCombat(serverPlayer)).orElse("This feature is disabled."));
                return ActionResult.FAIL;
            }

            return ActionResult.PASS;
        });

        UseEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            if (!(player instanceof ServerPlayerEntity serverPlayer) || !(entity instanceof ZombieVillagerEntity zombieVillager)) {
                return ActionResult.PASS;
            }

            ItemStack stack = player.getStackInHand(hand);
            if (!DisabledFeatureRules.isNormalWeaknessPotion(stack)) {
                return ActionResult.PASS;
            }

            if (world.isClient()) {
                return ActionResult.SUCCESS;
            }

            if (zombieVillager.isConverting()) {
                return ActionResult.SUCCESS_SERVER;
            }

            stack.get(net.minecraft.component.DataComponentTypes.POTION_CONTENTS).apply(zombieVillager, 1.0F);
            ((ZombieVillagerEntityInvoker) zombieVillager).shd$setConverting(
                    serverPlayer.getUuid(),
                    MIN_ZOMBIE_VILLAGER_CONVERSION_TICKS
                            + zombieVillager.getRandom().nextInt(MAX_ZOMBIE_VILLAGER_CONVERSION_TICKS - MIN_ZOMBIE_VILLAGER_CONVERSION_TICKS + 1)
            );
            consumePotionBottle(serverPlayer, hand, stack);
            serverPlayer.swingHand(hand, true);
            return ActionResult.SUCCESS_SERVER;
        });

        ServerTickEvents.END_SERVER_TICK.register(this::sanitizePlayers);
    }

    private void consumePotionBottle(ServerPlayerEntity player, net.minecraft.util.Hand hand, ItemStack stack) {
        if (player.isCreative()) {
            return;
        }

        if (stack.getCount() == 1) {
            player.setStackInHand(hand, new ItemStack(Items.GLASS_BOTTLE));
            return;
        }

        stack.decrement(1);
        player.giveOrDropStack(new ItemStack(Items.GLASS_BOTTLE));
    }

    private void sanitizePlayers(MinecraftServer server) {
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            boolean changed = false;
            for (int slot = 0; slot < player.getInventory().size(); slot++) {
                ItemStack stack = player.getInventory().getStack(slot);
                if (stack.isEmpty()) {
                    continue;
                }

                if (DisabledFeatureRules.isInventoryBlocked(stack, inCombat(player))) {
                    player.getInventory().setStack(slot, ItemStack.EMPTY);
                    warn(player, DisabledFeatureRules.blockedReason(stack, inCombat(player)).orElse(stack.getName().getString() + " was removed."));
                    changed = true;
                    continue;
                }

                if (DisabledFeatureRules.clampRestrictedEnchantments(stack)) {
                    warn(player, stack.getName().getString() + " enchantments were reduced to the season limit.");
                    changed = true;
                }
            }

            for (EquipmentSlot slot : EquipmentSlot.VALUES) {
                if (!slot.isArmorSlot()) {
                    continue;
                }

                ItemStack stack = player.getEquippedStack(slot);
                if (stack.isEmpty()) {
                    continue;
                }

                if (DisabledFeatureRules.isInventoryBlocked(stack, inCombat(player))) {
                    player.equipStack(slot, ItemStack.EMPTY);
                    warn(player, DisabledFeatureRules.blockedReason(stack, inCombat(player)).orElse(stack.getName().getString() + " was removed."));
                    changed = true;
                    continue;
                }

                if (DisabledFeatureRules.clampRestrictedEnchantments(stack)) {
                    warn(player, stack.getName().getString() + " enchantments were reduced to the season limit.");
                    changed = true;
                }
            }

            if (changed) {
                player.getInventory().markDirty();
            }
        }
    }

    private boolean inCombat(ServerPlayerEntity player) {
        return combatTagService.isTagged(player.getUuid(), Instant.now());
    }

    private void warn(ServerPlayerEntity player, String message) {
        UiNotifier.playerNotice(uiBridgeManager, player, "disabled_feature", message);
    }
}
