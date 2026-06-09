package com.shd.lifesteal.mixin;

import com.shd.lifesteal.impl.restriction.DisabledFeatureRules;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.inventory.CraftingResultInventory;
import net.minecraft.screen.ForgingScreenHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ForgingScreenHandler.class)
public abstract class ForgingScreenHandlerMixin {
    @Shadow
    protected CraftingResultInventory output;

    @Inject(method = "canTakeOutput", at = @At("HEAD"), cancellable = true)
    private void shd$blockRestrictedForgingOutput(PlayerEntity player, boolean present, CallbackInfoReturnable<Boolean> cir) {
        if (DisabledFeatureRules.isRestrictedOutput(output.getStack(0))) {
            cir.setReturnValue(false);
        }
    }
}
