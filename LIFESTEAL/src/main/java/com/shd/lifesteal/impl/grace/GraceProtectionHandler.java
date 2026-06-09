package com.shd.lifesteal.impl.grace;

import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.server.network.ServerPlayerEntity;

public final class GraceProtectionHandler {
    private final GracePeriodService gracePeriodService;

    public GraceProtectionHandler(GracePeriodService gracePeriodService) {
        this.gracePeriodService = gracePeriodService;
    }

    public void register() {
        ServerLivingEntityEvents.ALLOW_DAMAGE.register(this::allowDamage);
    }

    private boolean allowDamage(LivingEntity entity, net.minecraft.entity.damage.DamageSource source, float amount) {
        if (!gracePeriodService.snapshot().active()) {
            return true;
        }

        if (!(entity instanceof ServerPlayerEntity)) {
            return true;
        }

        Entity attacker = source.getAttacker();
        return !(attacker instanceof ServerPlayerEntity);
    }
}
