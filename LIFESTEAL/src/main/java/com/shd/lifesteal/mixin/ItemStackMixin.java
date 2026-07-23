package com.shd.lifesteal.mixin;

import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import java.util.function.Consumer;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemConvertible;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ItemStack.class)
public abstract class ItemStackMixin {
    @Inject(method = "onItemEntityDestroyed", at = @At("HEAD"))
    private void shd$retireDestroyedMaceItemEntity(ItemEntity entity, CallbackInfo ci) {
        MaceLimitRules.retireMace((ItemStack) (Object) this, "item entity destroyed at " + entity.getBlockPos().toShortString());
    }

    @Inject(
        method = "damage(ILnet/minecraft/server/world/ServerWorld;Lnet/minecraft/server/network/ServerPlayerEntity;Ljava/util/function/Consumer;)V",
        at = @At("HEAD")
    )
    private void shd$retireMaceBeforeServerPlayerBreak(
            int amount,
            ServerWorld world,
            ServerPlayerEntity player,
            Consumer<Item> breakCallback,
            CallbackInfo ci
    ) {
        String reason = player != null
                ? "broke while used by " + player.getName().getString()
                : "broke without a player";

        retireIfBreaking(amount, reason);
    }

    @Inject(method = "damage(ILnet/minecraft/entity/player/PlayerEntity;)V", at = @At("HEAD"))
    private void shd$retireMaceBeforePlayerBreak(int amount, PlayerEntity player, CallbackInfo ci) {
        retireIfBreaking(amount, "broke while used by " + player.getName().getString());
    }

    @Inject(method = "damage(ILnet/minecraft/entity/LivingEntity;Lnet/minecraft/util/Hand;)V", at = @At("HEAD"))
    private void shd$retireMaceBeforeHandBreak(int amount, LivingEntity entity, net.minecraft.util.Hand hand, CallbackInfo ci) {
        retireIfBreaking(amount, "broke in " + entity.getName().getString() + " hand");
    }

    @Inject(method = "damage(ILnet/minecraft/entity/LivingEntity;Lnet/minecraft/entity/EquipmentSlot;)V", at = @At("HEAD"))
    private void shd$retireMaceBeforeEquipmentBreak(int amount, LivingEntity entity, EquipmentSlot slot, CallbackInfo ci) {
        retireIfBreaking(amount, "broke on " + entity.getName().getString() + " " + slot.getName());
    }

    @Inject(method = "damage(ILnet/minecraft/item/ItemConvertible;Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/entity/EquipmentSlot;)Lnet/minecraft/item/ItemStack;", at = @At("HEAD"))
    private void shd$retireMaceBeforeConvertibleBreak(int amount, ItemConvertible item, LivingEntity entity, EquipmentSlot slot, CallbackInfoReturnable<ItemStack> cir) {
        retireIfBreaking(amount, "broke on " + entity.getName().getString() + " " + slot.getName());
    }

    private void retireIfBreaking(int amount, String reason) {
        ItemStack stack = (ItemStack) (Object) this;
        if (!stack.isDamageable() || amount <= 0) {
            return;
        }

        if (stack.getDamage() + amount >= stack.getMaxDamage()) {
            MaceLimitRules.retireMace(stack, reason);
        }
    }
}
