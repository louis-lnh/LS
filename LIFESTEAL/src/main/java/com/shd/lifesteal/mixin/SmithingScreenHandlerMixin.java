package com.shd.lifesteal.mixin;

import com.shd.lifesteal.impl.restriction.DisabledFeatureRules;
import net.minecraft.inventory.CraftingResultInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.SmithingScreenHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(SmithingScreenHandler.class)
public abstract class SmithingScreenHandlerMixin {
    @Inject(method = "updateResult", at = @At("RETURN"))
    private void shd$clearRestrictedSmithingOutput(CallbackInfo ci) {
        CraftingResultInventory output = ((ForgingScreenHandlerAccessor) (Object) this).shd$getOutput();
        if (DisabledFeatureRules.isRestrictedOutput(output.getStack(0))) {
            output.setStack(0, ItemStack.EMPTY);
        }
    }
}
