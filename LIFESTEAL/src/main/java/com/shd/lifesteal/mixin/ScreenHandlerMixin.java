package com.shd.lifesteal.mixin;

import com.shd.lifesteal.api.LifestealApi;
import com.shd.lifesteal.api.LifestealService;
import com.shd.lifesteal.impl.item.HeartItem;
import com.shd.lifesteal.impl.restriction.DisabledFeatureRules;
import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.screen.AbstractCraftingScreenHandler;
import net.minecraft.screen.ForgingScreenHandler;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.slot.Slot;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
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
        if (!isResultSlot(handler, slotIndex)) {
            return;
        }

        Slot slot = handler.getSlot(slotIndex);
        if (MaceLimitRules.blocksNewMace(slot.getStack(), serverPlayer.getEntityWorld().getServer())) {
            serverPlayer.sendMessage(Text.literal("Only two maces may exist at a time."), true);
            ci.cancel();
            return;
        }

        MaceLimitRules.CraftedMaceResult craftedMace = MaceLimitRules.markCraftedMace(
                slot.getStack(),
                serverPlayer.getEntityWorld().getServer(),
                "crafted by " + serverPlayer.getName().getString(),
                serverPlayer
        );
        if (craftedMace.created()) {
            announceCraftedMace(serverPlayer, craftedMace.activeCount());
        }

        if (slot.getStack().getItem() instanceof HeartItem) {
            if (craftedHeartBlocked(serverPlayer)) {
                serverPlayer.sendMessage(Text.literal("Crafted hearts can only be made below 10 hearts and outside grace period."), true);
                ci.cancel();
                return;
            }

            HeartItem.markCrafted(slot.getStack());
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

    private void announceCraftedMace(ServerPlayerEntity player, int activeCount) {
        String playerName = player.getName().getString();
        String message = activeCount >= MaceLimitRules.MAX_MACES
                ? playerName + " acquired the second Mace. Maces are no longer craftable!"
                : playerName + " acquired one Mace. " + Math.max(1, activeCount) + "/" + MaceLimitRules.MAX_MACES + " crafted.";
        player.getEntityWorld()
                .getServer()
                .getPlayerManager()
                .getPlayerList()
                .forEach(onlinePlayer -> onlinePlayer.sendMessage(Text.literal(message).formatted(Formatting.GOLD), false));
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
        return false;
    }
}
