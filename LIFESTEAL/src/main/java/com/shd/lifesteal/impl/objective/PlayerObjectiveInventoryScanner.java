package com.shd.lifesteal.impl.objective;

import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.BundleContentsComponent;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PlayerObjectiveInventoryScanner {
    private PlayerObjectiveInventoryScanner() {
    }

    public static boolean carries(ServerPlayerEntity player, Item item) {
        for (int slot = 0; slot < player.getInventory().size(); slot++) {
            if (contains(player.getInventory().getStack(slot), item)) {
                return true;
            }
        }

        return contains(player.currentScreenHandler.getCursorStack(), item);
    }

    private static boolean contains(ItemStack stack, Item item) {
        if (stack.isEmpty()) {
            return false;
        }

        if (stack.isOf(item)) {
            return true;
        }

        BundleContentsComponent bundleContents = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
        if (bundleContents == null || bundleContents.isEmpty()) {
            return false;
        }

        for (ItemStack bundledStack : bundleContents.iterateCopy()) {
            if (contains(bundledStack, item)) {
                return true;
            }
        }
        return false;
    }
}
