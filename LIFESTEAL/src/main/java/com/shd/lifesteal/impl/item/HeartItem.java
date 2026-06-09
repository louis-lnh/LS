package com.shd.lifesteal.impl.item;

import com.shd.lifesteal.api.HeartChangeReason;
import com.shd.lifesteal.api.HeartChangeResult;
import com.shd.lifesteal.api.PlayerHeartState;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.NbtComponent;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

public final class HeartItem extends Item {
    private static final String CRAFTED_KEY = "shd_lifesteal_crafted";

    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;

    public HeartItem(HeartService heartService, PlayerHeartApplier playerHeartApplier, Settings settings) {
        super(settings);
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (world.isClient() || !(user instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }

        PlayerHeartState state = heartService.ensurePlayer(serverPlayer.getUuid());
        ItemStack stack = serverPlayer.getStackInHand(hand);
        if (isCrafted(stack) && state.hearts() >= heartService.startingHearts()) {
            serverPlayer.sendMessage(Text.literal("Crafted hearts can only be used below 10 hearts."), true);
            return ActionResult.FAIL;
        }

        if (state.hearts() >= heartService.maxHearts()) {
            serverPlayer.sendMessage(Text.literal("You already have the maximum number of hearts."), true);
            return ActionResult.FAIL;
        }

        HeartChangeResult result = heartService.addHearts(serverPlayer.getUuid(), 1, HeartChangeReason.HEART_ITEM);
        playerHeartApplier.applyHearts(serverPlayer, result.newHearts());

        stack.decrementUnlessCreative(1, serverPlayer);
        serverPlayer.sendMessage(Text.literal("You gained one heart."), true);
        return ActionResult.SUCCESS_SERVER;
    }

    public static void markCrafted(ItemStack stack) {
        NbtComponent.set(DataComponentTypes.CUSTOM_DATA, stack, nbt -> nbt.putBoolean(CRAFTED_KEY, true));
    }

    public static boolean isCrafted(ItemStack stack) {
        NbtComponent customData = stack.get(DataComponentTypes.CUSTOM_DATA);
        if (customData == null) {
            return false;
        }

        NbtCompound nbt = customData.copyNbt();
        return nbt.getBoolean(CRAFTED_KEY, false);
    }
}
