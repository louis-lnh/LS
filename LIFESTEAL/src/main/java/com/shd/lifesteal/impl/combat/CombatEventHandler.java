package com.shd.lifesteal.impl.combat;

import com.shd.lifesteal.impl.config.LifestealRuleSettings;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.restriction.DisabledFeatureRules;
import com.shd.lifesteal.impl.restriction.ElytraCombatCooldownService;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import com.shd.lifesteal.impl.ui.UiNotifier;
import java.time.Instant;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.server.network.ServerPlayerEntity;

public final class CombatEventHandler {
    private final CombatTagService combatTagService;
    private final GracePeriodService gracePeriodService;
    private final LifestealRuleSettings ruleSettings;
    private final ElytraCombatCooldownService elytraCombatCooldownService;
    private final UiBridgeManager uiBridgeManager;

    public CombatEventHandler(
            CombatTagService combatTagService,
            GracePeriodService gracePeriodService,
            LifestealRuleSettings ruleSettings,
            ElytraCombatCooldownService elytraCombatCooldownService,
            UiBridgeManager uiBridgeManager
    ) {
        this.combatTagService = combatTagService;
        this.gracePeriodService = gracePeriodService;
        this.ruleSettings = ruleSettings;
        this.elytraCombatCooldownService = elytraCombatCooldownService;
        this.uiBridgeManager = uiBridgeManager;
    }

    public void register() {
        ServerLivingEntityEvents.ALLOW_DAMAGE.register(this::allowDamage);
        ServerLivingEntityEvents.AFTER_DAMAGE.register(this::afterDamage);
    }

    private boolean allowDamage(LivingEntity entity, net.minecraft.entity.damage.DamageSource source, float amount) {
        if (!ruleSettings.spearCombatBan() || !(entity instanceof ServerPlayerEntity)) {
            return true;
        }

        Entity attacker = source.getAttacker();
        if (!(attacker instanceof ServerPlayerEntity playerAttacker)) {
            return true;
        }

        Instant now = Instant.now();
        if (!elytraCombatCooldownService.isActive(playerAttacker.getUuid(), now)) {
            return true;
        }

        if (!DisabledFeatureRules.isSpear(playerAttacker.getMainHandStack()) && !DisabledFeatureRules.isSpear(playerAttacker.getOffHandStack())) {
            return true;
        }

        UiNotifier.playerNotice(uiBridgeManager, playerAttacker, "disabled_feature", "Spears are disabled while combat tagged.");
        return false;
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
        elytraCombatCooldownService.apply(playerAttacker, ruleSettings.spearCombatBan(), now);
        elytraCombatCooldownService.apply(victim, ruleSettings.spearCombatBan(), now);
    }
}
