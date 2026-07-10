package com.shd.lifesteal.mixin;

import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import com.shd.lifesteal.impl.item.HeartItem;
import com.shd.lifesteal.impl.revival.RevivalBeaconItem;
import com.shd.lifesteal.impl.restriction.DisabledFeatureRules;
import java.util.Optional;
import net.minecraft.block.BlockState;
import net.minecraft.block.CrafterBlock;
import net.minecraft.block.entity.CrafterBlockEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.recipe.CraftingRecipe;
import net.minecraft.recipe.RecipeEntry;
import net.minecraft.recipe.input.CraftingRecipeInput;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(CrafterBlock.class)
public abstract class CrafterBlockMixin {
    @Inject(method = "craft", at = @At("HEAD"), cancellable = true)
    private void shd$blockLimitedMaceAutocraft(BlockState state, ServerWorld world, BlockPos pos, CallbackInfo ci) {
        if (!(world.getBlockEntity(pos) instanceof CrafterBlockEntity crafter)) {
            return;
        }

        CraftingRecipeInput input = CraftingRecipeInput.create(crafter.getWidth(), crafter.getHeight(), crafter.getHeldStacks());
        Optional<RecipeEntry<CraftingRecipe>> recipe = CrafterBlock.getCraftingRecipe(world, input);
        if (recipe.isEmpty()) {
            return;
        }

        ItemStack output = recipe.get().value().craft(input, world.getRegistryManager());
        if (output.getItem() instanceof HeartItem || DisabledFeatureRules.isRestrictedOutput(output) || output.isOf(net.minecraft.item.Items.MACE)) {
            ci.cancel();
            return;
        }

        if (MaceLimitRules.blocksNewMace(output, world.getServer())) {
            ci.cancel();
        }
    }

    @Inject(method = "transferOrSpawnStack", at = @At("HEAD"))
    private void shd$tagAutocraftedMace(ServerWorld world, BlockPos pos, CrafterBlockEntity crafter, ItemStack stack, BlockState state, RecipeEntry<?> recipe, CallbackInfo ci) {
        MaceLimitRules.markCraftedMace(stack, world.getServer(), "autocrafted at " + world.getRegistryKey().getValue() + " " + pos.toShortString());
        if (isRevivalBeaconRecipe(crafter, stack)) {
            RevivalBeaconItem.markRevivalBeacon(stack);
        }
    }

    private boolean isRevivalBeaconRecipe(CrafterBlockEntity crafter, ItemStack stack) {
        if (!stack.isOf(net.minecraft.item.Items.BEACON)) {
            return false;
        }

        for (ItemStack inputStack : crafter.getHeldStacks()) {
            if (inputStack.getItem() instanceof HeartItem) {
                return true;
            }
        }
        return false;
    }
}
