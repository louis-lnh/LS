package com.shd.lifesteal.mixin;

import java.util.UUID;
import net.minecraft.entity.mob.ZombieVillagerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(ZombieVillagerEntity.class)
public interface ZombieVillagerEntityInvoker {
    @Invoker("setConverting")
    void shd$setConverting(UUID uuid, int delay);
}
