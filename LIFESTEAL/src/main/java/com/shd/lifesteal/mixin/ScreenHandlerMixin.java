package com.shd.lifesteal.mixin;

import com.shd.lifesteal.api.LifestealApi;
import com.shd.lifesteal.api.LifestealService;
import com.shd.lifesteal.impl.anticheat.MacroActionBurstCheck;
import com.shd.lifesteal.impl.item.HeartItem;
import com.shd.lifesteal.impl.revival.RevivalBeaconItem;
import com.shd.lifesteal.impl.restriction.DisabledFeatureRules;
import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import net.minecraft.item.Items;
import net.minecraft.registry.Registries;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.screen.AbstractCraftingScreenHandler;
import net.minecraft.screen.ForgingScreenHandler;
import net.minecraft.screen.GrindstoneScreenHandler;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.slot.Slot;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ScreenHandler.class)
public abstract class ScreenHandlerMixin {
    @Inject(method = "onSlotClick", at = @At("HEAD"), cancellable = true)
    private void shd$blockRestrictedResult(int slotIndex, int button, SlotActionType actionType, PlayerEntity player, CallbackInfo ci) {
        if (!(player instanceof ServerPlayerEntity serverPlayer) || slotIndex < 0) {
            return;
        }

        ScreenHandler handler = (ScreenHandler) (Object) this;
        if (slotIndex < handler.slots.size()) {
            Slot clickedSlot = handler.getSlot(slotIndex);
            String itemId = clickedSlot.getStack().isEmpty() ? "empty" : Registries.ITEM.getId(clickedSlot.getStack().getItem()).toString();
            MacroActionBurstCheck.recordInventoryClick(serverPlayer, slotIndex, button, actionType.name(), itemId);
        }

        if (!isResultSlot(handler, slotIndex)) {
            return;
        }

        Slot slot = handler.getSlot(slotIndex);
        if (MaceLimitRules.blocksNewMace(slot.getStack(), serverPlayer.getEntityWorld().getServer())) {
            serverPlayer.sendMessage(Text.literal("Maces are event-only custom items."), true);
            ci.cancel();
            return;
        }

        if (MaceLimitRules.isCustomMace(slot.getStack())) {
            serverPlayer.sendMessage(Text.literal("Event maces cannot be modified."), true);
            ci.cancel();
            return;
        }

        if (slot.getStack().getItem() instanceof HeartItem) {
            if (craftedHeartBlocked(serverPlayer)) {
                serverPlayer.sendMessage(Text.literal("Crafted hearts can only be made below 10 hearts and outside grace period."), true);
                ci.cancel();
                return;
            }

            HeartItem.markCrafted(slot.getStack());
        }

        if (slot.getStack().isOf(Items.BEACON) && isRevivalBeaconRecipeResult(handler)) {
            RevivalBeaconItem.markRevivalBeacon(slot.getStack());
        }

        if (!DisabledFeatureRules.isRestrictedOutput(slot.getStack())) {
            return;
        }

        serverPlayer.sendMessage(Text.literal("This feature is disabled."), true);
        ci.cancel();
    }

    private boolean craftedHeartBlocked(ServerPlayerEntity player) {
        return LifestealApi.get()
                .map(service -> isCraftedHeartBlocked(player, service))
                .orElse(false);
    }

    private boolean isCraftedHeartBlocked(ServerPlayerEntity player, LifestealService service) {
        if (service.gracePeriod().active()) {
            return true;
        }

        int hearts = service.heartState(player.getUuid())
                .map(state -> state.hearts())
                .orElse(service.startingHearts());
        return hearts >= service.startingHearts();
    }

    private boolean isResultSlot(ScreenHandler handler, int slotIndex) {
        if (handler instanceof AbstractCraftingScreenHandler craftingHandler) {
            return craftingHandler.getOutputSlot().id == slotIndex;
        }
        if (handler instanceof ForgingScreenHandler forgingHandler) {
            return forgingHandler.getResultSlotIndex() == slotIndex;
        }
        if (handler instanceof GrindstoneScreenHandler) {
            return slotIndex == 2;
        }
        return false;
    }

    private boolean isRevivalBeaconRecipeResult(ScreenHandler handler) {
        if (!(handler instanceof AbstractCraftingScreenHandler)) {
            return false;
        }

        AbstractCraftingScreenHandler craftingHandler = (AbstractCraftingScreenHandler) handler;
        for (Slot slot : craftingHandler.getInputSlots()) {
            if (slot.getStack().getItem() instanceof HeartItem) {
                return true;
            }
        }
        return false;
    }
}
