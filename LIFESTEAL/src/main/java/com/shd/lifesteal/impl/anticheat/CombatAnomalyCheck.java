package com.shd.lifesteal.impl.anticheat;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

public final class CombatAnomalyCheck implements AntiCheatCheck {
    private final Map<UUID, Queue<CombatSample>> pendingSamples = new HashMap<>();
    private final Map<UUID, CombatState> states = new HashMap<>();

    @Override
    public String id() {
        return "combat_anomaly";
    }

    @Override
    public void register() {
        ServerLivingEntityEvents.AFTER_DAMAGE.register(this::afterDamage);
    }

    @Override
    public void tick(AntiCheatCheckContext context) {
        if (!context.settings().combatChecksEnabled()) {
            return;
        }

        Queue<CombatSample> samples = pendingSamples.remove(context.player().getUuid());
        if (samples == null) {
            return;
        }

        CombatState state = states.computeIfAbsent(context.player().getUuid(), ignored -> new CombatState());
        for (CombatSample sample : samples) {
            checkReach(context, state, sample);
            checkAttackTiming(context, state, sample);
            checkAttackCooldown(context, state, sample);
            checkMultiTarget(context, state, sample);
            checkTargetSwitch(context, state, sample);
            checkLineOfSight(context, state, sample);
            checkMenuAttack(context, state, sample);
            checkUsingItemAttack(context, state, sample);
            checkAirborneCriticalPattern(context, state, sample);
            checkDamageSpike(context, state, sample);
            checkImpossibleModes(context, state, sample);
        }
    }

    @Override
    public void endServerTick(AntiCheatServerTickContext context) {
        if (!context.settings().enabled() || !context.settings().combatChecksEnabled()) {
            pendingSamples.clear();
            return;
        }
        pendingSamples.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
        states.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
    }

    private void afterDamage(LivingEntity entity, net.minecraft.entity.damage.DamageSource source, float baseDamageTaken, float damageTaken, boolean blocked) {
        Entity attacker = source.getAttacker();
        if (!(attacker instanceof ServerPlayerEntity playerAttacker)) {
            return;
        }

        if (entity.getUuid().equals(playerAttacker.getUuid())) {
            return;
        }

        CombatSample sample = CombatSample.capture(playerAttacker, entity, baseDamageTaken, damageTaken, blocked);
        pendingSamples.computeIfAbsent(playerAttacker.getUuid(), ignored -> new ArrayDeque<>()).add(sample);
    }

    private void checkReach(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (sample.eyeToTargetBoxDistance() <= context.settings().combatMaxReachBlocks()
                && sample.verticalDistance() <= context.settings().combatMaxVerticalReachBlocks()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "combat_reach", "Unusual combat reach detected", sample, "eyeDistance=%.2f max=%.2f centerDistance=%.2f vertical=%.2f verticalMax=%.2f target=%s baseDamage=%.2f damage=%.2f blocked=%s".formatted(
                sample.eyeToTargetBoxDistance(),
                context.settings().combatMaxReachBlocks(),
                sample.centerDistance(),
                sample.verticalDistance(),
                context.settings().combatMaxVerticalReachBlocks(),
                sample.targetName(),
                sample.baseDamageTaken(),
                sample.damageTaken(),
                sample.blocked()
        ));
    }

    private void checkAttackTiming(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        long previousTick = state.lastAttackTick;
        state.lastAttackTick = context.tick();
        long elapsedTicks = context.tick() - previousTick;
        if (previousTick == Long.MIN_VALUE || elapsedTicks >= context.settings().combatMinAttackIntervalTicks()) {
            state.rapidAttackBuffer = Math.max(0, state.rapidAttackBuffer - 1);
            return;
        }

        state.rapidAttackBuffer++;
        if (state.rapidAttackBuffer < context.settings().combatRapidAttackBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "combat_rapid_attack", "Unusual attack timing detected", sample, "elapsedTicks=%d minTicks=%d rapidBuffer=%d target=%s damage=%.2f".formatted(
                elapsedTicks,
                context.settings().combatMinAttackIntervalTicks(),
                state.rapidAttackBuffer,
                sample.targetName(),
                sample.damageTaken()
        ));
        state.rapidAttackBuffer = 0;
    }

    private void checkAttackCooldown(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (sample.attackCooldownProgress() >= context.settings().combatLowCooldownThreshold()) {
            state.lowCooldownBuffer = Math.max(0, state.lowCooldownBuffer - 1);
            return;
        }

        state.lowCooldownBuffer++;
        if (state.lowCooldownBuffer < context.settings().combatLowCooldownBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "combat_low_cooldown", "Unusual repeated low-cooldown attacks detected", sample, "cooldown=%.2f threshold=%.2f buffer=%d required=%d target=%s".formatted(
                sample.attackCooldownProgress(),
                context.settings().combatLowCooldownThreshold(),
                state.lowCooldownBuffer,
                context.settings().combatLowCooldownBuffer(),
                sample.targetName()
        ));
        state.lowCooldownBuffer = 0;
    }

    private void checkMultiTarget(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        long oldestAllowedTick = context.tick() - context.settings().combatMultiTargetWindowTicks();
        while (!state.recentTargets.isEmpty() && state.recentTargets.peekFirst().tick() < oldestAllowedTick) {
            state.recentTargets.removeFirst();
        }
        state.recentTargets.addLast(new TargetHit(sample.targetId(), context.tick()));

        Set<UUID> uniqueTargets = new HashSet<>();
        for (TargetHit hit : state.recentTargets) {
            uniqueTargets.add(hit.targetId());
        }

        if (uniqueTargets.size() <= context.settings().combatMaxTargetsPerWindow()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "combat_multi_target", "Unusual multi-target combat detected", sample, "uniqueTargets=%d maxTargets=%d windowTicks=%d latestTarget=%s".formatted(
                uniqueTargets.size(),
                context.settings().combatMaxTargetsPerWindow(),
                context.settings().combatMultiTargetWindowTicks(),
                sample.targetName()
        ));
    }

    private void checkTargetSwitch(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (state.lastTargetId == null || state.lastTargetId.equals(sample.targetId())) {
            state.lastTargetId = sample.targetId();
            state.targetSwitchBuffer = Math.max(0, state.targetSwitchBuffer - 1);
            return;
        }

        state.lastTargetId = sample.targetId();
        state.targetSwitchBuffer++;
        if (state.targetSwitchBuffer < context.settings().combatTargetSwitchBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "combat_target_switch", "Unusual target switching detected", sample, "targetSwitchBuffer=%d required=%d latestTarget=%s".formatted(
                state.targetSwitchBuffer,
                context.settings().combatTargetSwitchBuffer(),
                sample.targetName()
        ));
        state.targetSwitchBuffer = 0;
    }

    private void checkLineOfSight(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (sample.hasLineOfSight()) {
            state.lineOfSightBuffer = Math.max(0, state.lineOfSightBuffer - 1);
            return;
        }

        state.lineOfSightBuffer++;
        if (state.lineOfSightBuffer < context.settings().combatLineOfSightBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "combat_line_of_sight", "Unusual combat line of sight detected", sample, "lineOfSightBuffer=%d required=%d target=%s eyeDistance=%.2f".formatted(
                state.lineOfSightBuffer,
                context.settings().combatLineOfSightBuffer(),
                sample.targetName(),
                sample.eyeToTargetBoxDistance()
        ));
        state.lineOfSightBuffer = 0;
    }

    private void checkMenuAttack(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (!sample.menuOpen()) {
            state.menuAttackBuffer = Math.max(0, state.menuAttackBuffer - 1);
            return;
        }

        state.menuAttackBuffer++;
        if (state.menuAttackBuffer < context.settings().combatMenuAttackBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "combat_menu_attack", "Unusual attack while menu is open detected", sample, "menuAttackBuffer=%d required=%d target=%s".formatted(
                state.menuAttackBuffer,
                context.settings().combatMenuAttackBuffer(),
                sample.targetName()
        ));
        state.menuAttackBuffer = 0;
    }

    private void checkUsingItemAttack(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (!sample.usingItem() && !sample.blocking()) {
            state.usingItemAttackBuffer = Math.max(0, state.usingItemAttackBuffer - 1);
            return;
        }

        state.usingItemAttackBuffer++;
        if (state.usingItemAttackBuffer < context.settings().combatUsingItemAttackBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "combat_using_item_attack", "Unusual attack while using an item detected", sample, "usingItem=%s blocking=%s buffer=%d required=%d target=%s".formatted(
                sample.usingItem(),
                sample.blocking(),
                state.usingItemAttackBuffer,
                context.settings().combatUsingItemAttackBuffer(),
                sample.targetName()
        ));
        state.usingItemAttackBuffer = 0;
    }

    private void checkAirborneCriticalPattern(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (sample.attackerOnGround()
                || sample.attackerTouchingWater()
                || sample.attackerInLava()
                || sample.attackerClimbing()
                || sample.attackerGliding()
                || sample.attackerHasVehicle()
                || sample.attackerLevitation()
                || sample.attackerSlowFalling()) {
            state.criticalBuffer = Math.max(0, state.criticalBuffer - 1);
            return;
        }

        if (sample.attackerFallDistance() >= context.settings().combatCriticalMinFallDistance()) {
            state.criticalBuffer = Math.max(0, state.criticalBuffer - 1);
            return;
        }

        state.criticalBuffer++;
        if (state.criticalBuffer < context.settings().combatCriticalBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "combat_airborne_hit", "Suspicious airborne hit pattern detected", sample, "criticalBuffer=%d required=%d fallDistance=%.3f minFall=%.3f velocityY=%.3f target=%s".formatted(
                state.criticalBuffer,
                context.settings().combatCriticalBuffer(),
                sample.attackerFallDistance(),
                context.settings().combatCriticalMinFallDistance(),
                sample.attackerVelocityY(),
                sample.targetName()
        ));
        state.criticalBuffer = 0;
    }

    private void checkDamageSpike(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (sample.damageTaken() <= context.settings().combatMaxDamageTaken()
                && sample.baseDamageTaken() <= context.settings().combatMaxDamageTaken()) {
            state.damageSpikeBuffer = Math.max(0, state.damageSpikeBuffer - 1);
            return;
        }

        state.damageSpikeBuffer++;
        if (state.damageSpikeBuffer < context.settings().combatDamageSpikeBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "combat_damage_spike", "Unusual combat damage detected", sample, "baseDamage=%.2f damage=%.2f max=%.2f buffer=%d required=%d target=%s blocked=%s".formatted(
                sample.baseDamageTaken(),
                sample.damageTaken(),
                context.settings().combatMaxDamageTaken(),
                state.damageSpikeBuffer,
                context.settings().combatDamageSpikeBuffer(),
                sample.targetName(),
                sample.blocked()
        ));
        state.damageSpikeBuffer = 0;
    }

    private void checkImpossibleModes(AntiCheatCheckContext context, CombatState state, CombatSample sample) {
        if (sample.attackerSpectator()) {
            alert(context, state, AntiCheatSeverity.CRITICAL, "combat_spectator_attack", "Impossible spectator attack detected", sample, "target=%s damage=%.2f".formatted(
                    sample.targetName(),
                    sample.damageTaken()
            ));
        }

        if (sample.attackerBlindness()) {
            alert(context, state, AntiCheatSeverity.WARNING, "combat_blind_attack", "Unusual attack while blinded detected", sample, "target=%s eyeDistance=%.2f damage=%.2f".formatted(
                    sample.targetName(),
                    sample.eyeToTargetBoxDistance(),
                    sample.damageTaken()
            ));
        }
    }

    private void alert(AntiCheatCheckContext context, CombatState state, AntiCheatSeverity severity, String reasonCode, String publicReason, CombatSample sample, String detail) {
        long lastAlertTick = state.lastAlertTicks.getOrDefault(reasonCode, Long.MIN_VALUE);
        if (context.tick() - lastAlertTick < context.settings().combatAlertCooldownTicks()) {
            return;
        }
        state.lastAlertTicks.put(reasonCode, context.tick());

        context.antiCheatService().handle(context.server(), context.player(), new AntiCheatDetection(
                AntiCheatCategory.COMBAT,
                severity,
                reasonCode,
                publicReason,
                "check=%s %s attackerCreative=%s attackerSpectator=%s menuOpen=%s usingItem=%s blocking=%s cooldown=%.2f lineOfSight=%s attacker=%.2f,%.2f,%.2f target=%.2f,%.2f,%.2f targetBoxCenter=%.2f,%.2f,%.2f velocityY=%.3f fallDistance=%.3f onGround=%s".formatted(
                        id(),
                        detail,
                        sample.attackerCreative(),
                        sample.attackerSpectator(),
                        sample.menuOpen(),
                        sample.usingItem(),
                        sample.blocking(),
                        sample.attackCooldownProgress(),
                        sample.hasLineOfSight(),
                        sample.attackerX(),
                        sample.attackerY(),
                        sample.attackerZ(),
                        sample.targetX(),
                        sample.targetY(),
                        sample.targetZ(),
                        sample.targetBoxCenterX(),
                        sample.targetBoxCenterY(),
                        sample.targetBoxCenterZ(),
                        sample.attackerVelocityY(),
                        sample.attackerFallDistance(),
                        sample.attackerOnGround()
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
    }

    private static final class CombatState {
        private long lastAttackTick = Long.MIN_VALUE;
        private UUID lastTargetId;
        private int rapidAttackBuffer;
        private int lowCooldownBuffer;
        private int targetSwitchBuffer;
        private int lineOfSightBuffer;
        private int menuAttackBuffer;
        private int usingItemAttackBuffer;
        private int criticalBuffer;
        private int damageSpikeBuffer;
        private final ArrayDeque<TargetHit> recentTargets = new ArrayDeque<>();
        private final Map<String, Long> lastAlertTicks = new HashMap<>();
    }

    private record CombatSample(
            UUID attackerId,
            UUID targetId,
            String targetName,
            double attackerX,
            double attackerY,
            double attackerZ,
            double targetX,
            double targetY,
            double targetZ,
            double targetBoxCenterX,
            double targetBoxCenterY,
            double targetBoxCenterZ,
            double centerDistance,
            double eyeToTargetBoxDistance,
            double verticalDistance,
            float baseDamageTaken,
            float damageTaken,
            boolean blocked,
            boolean attackerCreative,
            boolean attackerSpectator,
            boolean attackerOnGround,
            boolean attackerTouchingWater,
            boolean attackerInLava,
            boolean attackerClimbing,
            boolean attackerGliding,
            boolean attackerHasVehicle,
            boolean attackerSlowFalling,
            boolean attackerLevitation,
            boolean attackerBlindness,
            double attackerVelocityY,
            double attackerFallDistance,
            float attackCooldownProgress,
            boolean menuOpen,
            boolean usingItem,
            boolean blocking,
            boolean hasLineOfSight
    ) {
        static CombatSample capture(ServerPlayerEntity attacker, LivingEntity target, float baseDamageTaken, float damageTaken, boolean blocked) {
            Box targetBox = target.getBoundingBox();
            Vec3d targetBoxCenter = targetBox.getCenter();
            Vec3d attackerEye = attacker.getEyePos();
            double centerDistance = attackerEye.distanceTo(targetBoxCenter);
            double boxDistance = Math.sqrt(targetBox.squaredMagnitude(attackerEye));
            double verticalDistance = Math.abs(attacker.getY() - target.getY());
            return new CombatSample(
                    attacker.getUuid(),
                    target.getUuid(),
                    target.getName().getString(),
                    attacker.getX(),
                    attacker.getY(),
                    attacker.getZ(),
                    target.getX(),
                    target.getY(),
                    target.getZ(),
                    targetBoxCenter.x,
                    targetBoxCenter.y,
                    targetBoxCenter.z,
                    centerDistance,
                    boxDistance,
                    verticalDistance,
                    baseDamageTaken,
                    damageTaken,
                    blocked,
                    attacker.isCreative(),
                    attacker.isSpectator(),
                    attacker.isOnGround(),
                    attacker.isTouchingWater(),
                    attacker.isInLava(),
                    attacker.isClimbing(),
                    attacker.isGliding(),
                    attacker.hasVehicle(),
                    attacker.hasStatusEffect(StatusEffects.SLOW_FALLING),
                    attacker.hasStatusEffect(StatusEffects.LEVITATION),
                    attacker.hasStatusEffect(StatusEffects.BLINDNESS),
                    attacker.getVelocity().y,
                    attacker.fallDistance,
                    attacker.getAttackCooldownProgress(0.5F),
                    attacker.currentScreenHandler != attacker.playerScreenHandler,
                    attacker.isUsingItem(),
                    attacker.isBlocking(),
                    attacker.canSee(target)
            );
        }
    }

    private record TargetHit(UUID targetId, long tick) {
    }
}
