package com.shd.lifesteal.impl.combat;

import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.restriction.ElytraCombatCooldownService;
import java.time.Instant;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.server.network.ServerPlayerEntity;

public final class CombatEventHandler {
    private final CombatTagService combatTagService;
    private final GracePeriodService gracePeriodService;
    private final ElytraCombatCooldownService elytraCombatCooldownService;

    public CombatEventHandler(
            CombatTagService combatTagService,
            GracePeriodService gracePeriodService,
            ElytraCombatCooldownService elytraCombatCooldownService
    ) {
        this.combatTagService = combatTagService;
        this.gracePeriodService = gracePeriodService;
        this.elytraCombatCooldownService = elytraCombatCooldownService;
    }

    public void register() {
        ServerLivingEntityEvents.AFTER_DAMAGE.register(this::afterDamage);
    }

    private void afterDamage(LivingEntity entity, net.minecraft.entity.damage.DamageSource source, float baseDamageTaken, float damageTaken, boolean blocked) {
        if (gracePeriodService.snapshot().active()) {
            return;
        }

        if (!(entity instanceof ServerPlayerEntity victim)) {
            return;
        }

        Entity attacker = source.getAttacker();
        if (!(attacker instanceof ServerPlayerEntity playerAttacker)) {
            return;
        }

        if (playerAttacker.getUuid().equals(victim.getUuid())) {
            return;
        }

        Instant now = Instant.now();
        combatTagService.tag(playerAttacker.getUuid(), victim.getUuid(), now);
        elytraCombatCooldownService.apply(playerAttacker, now);
        elytraCombatCooldownService.apply(victim, now);
    }
}
