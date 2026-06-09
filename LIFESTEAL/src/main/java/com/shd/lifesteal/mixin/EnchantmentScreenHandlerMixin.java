package com.shd.lifesteal.mixin;

import com.shd.lifesteal.impl.restriction.DisabledFeatureRules;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.enchantment.EnchantmentLevelEntry;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.DynamicRegistryManager;
import net.minecraft.screen.EnchantmentScreenHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(EnchantmentScreenHandler.class)
public abstract class EnchantmentScreenHandlerMixin {
    @Inject(method = "generateEnchantments", at = @At("RETURN"), cancellable = true)
    private void shd$capRestrictedEnchantments(DynamicRegistryManager registryManager, ItemStack stack, int slot, int level, CallbackInfoReturnable<List<EnchantmentLevelEntry>> cir) {
        List<EnchantmentLevelEntry> generated = cir.getReturnValue();
        List<EnchantmentLevelEntry> capped = null;

        for (int index = 0; index < generated.size(); index++) {
            EnchantmentLevelEntry entry = generated.get(index);
            int maxAllowed = DisabledFeatureRules.maxAllowedLevel(entry.enchantment());
            if (maxAllowed <= 0 || entry.level() <= maxAllowed) {
                if (capped != null) {
                    capped.add(entry);
                }
                continue;
            }

            if (capped == null) {
                capped = new ArrayList<>(generated.subList(0, index));
            }
            capped.add(new EnchantmentLevelEntry(entry.enchantment(), maxAllowed));
        }

        if (capped != null) {
            cir.setReturnValue(capped);
        }
    }
}
