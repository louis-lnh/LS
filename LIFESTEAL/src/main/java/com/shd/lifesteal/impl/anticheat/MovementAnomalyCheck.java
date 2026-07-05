package com.shd.lifesteal.impl.anticheat;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.registry.tag.FluidTags;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

public final class MovementAnomalyCheck implements AntiCheatCheck {
    private final Map<UUID, MovementState> states = new HashMap<>();

    @Override
    public String id() {
        return "movement_anomaly";
    }

    @Override
    public void tick(AntiCheatCheckContext context) {
        if (!context.settings().movementChecksEnabled()) {
            return;
        }

        ServerPlayerEntity player = context.player();
        UUID playerId = player.getUuid();
        MovementSnapshot current = MovementSnapshot.capture(player, context.tick());
        MovementState state = states.computeIfAbsent(playerId, ignored -> new MovementState());
        MovementSnapshot previous = state.previousSnapshot;
        state.previousSnapshot = current;

        if (previous == null) {
            return;
        }

        MovementDelta delta = MovementDelta.between(previous, current);
        if (isTeleportReset(context, delta)) {
            state.resetTransientBuffers();
            return;
        }

        updateAirState(context, state, current, delta);
        checkBurst(context, state, current, previous, delta);
        checkSustainedSpeed(context, state, current, previous, delta);
        checkHover(context, state, current, previous, delta);
        checkFlyAscend(context, state, current, previous, delta);
        checkNoFall(context, state, current, previous, delta);
        checkWaterWalk(context, state, current, previous, delta);
        checkClipping(context, state, current, previous, delta);
    }

    @Override
    public void endServerTick(AntiCheatServerTickContext context) {
        states.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
    }

    private boolean isTeleportReset(AntiCheatCheckContext context, MovementDelta delta) {
        return delta.horizontal() > context.settings().movementTeleportResetDistance()
                || delta.verticalAbs() > context.settings().movementTeleportResetDistance();
    }

    private void updateAirState(AntiCheatCheckContext context, MovementState state, MovementSnapshot current, MovementDelta delta) {
        if (current.exemptFromAirChecks()) {
            state.airTicks = 0;
            state.hoverTicks = 0;
            state.upwardTicks = 0;
            state.airSpeedBuffer = Math.max(0, state.airSpeedBuffer - 1);
            state.accumulatedFallDistance = 0.0D;
            state.maxObservedFallDistance = 0.0F;
            return;
        }

        if (current.onGround()) {
            state.hoverTicks = 0;
            state.upwardTicks = 0;
            state.airSpeedBuffer = Math.max(0, state.airSpeedBuffer - 1);
            return;
        }

        state.airTicks++;
        if (delta.vertical() < 0.0D) {
            state.accumulatedFallDistance += Math.abs(delta.vertical());
        }
        state.maxObservedFallDistance = Math.max(state.maxObservedFallDistance, current.fallDistance());
    }

    private void checkBurst(
            AntiCheatCheckContext context,
            MovementState state,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta
    ) {
        if (current.exemptFromMovementChecks()) {
            return;
        }

        if (delta.horizontalPerTick() > context.settings().movementMaxSustainedHorizontalPerTick()
                || delta.verticalPerTickAbs() > context.settings().movementFlyUpwardPerTick()
                || Math.abs(delta.velocityY()) > context.settings().movementFlyUpwardPerTick()) {
            MacroActionBurstCheck.recordMovementBurst(context.player(), delta.horizontalPerTick(), delta.verticalPerTick(), delta.velocityY());
        }

        if (delta.horizontalPerTick() > context.settings().movementMaxHorizontalPerTick()) {
            alert(context, state, AntiCheatSeverity.WARNING, "movement_horizontal_burst", "Unusual horizontal movement detected", current, previous, delta,
                    "horizontalPerTick=%.2f max=%.2f".formatted(delta.horizontalPerTick(), context.settings().movementMaxHorizontalPerTick()));
        }

        if (delta.verticalPerTickAbs() > context.settings().movementMaxVerticalPerTick()
                || Math.abs(delta.velocityY()) > context.settings().movementMaxVerticalBurstPerTick()) {
            alert(context, state, AntiCheatSeverity.WARNING, "movement_vertical_burst", "Unusual vertical movement detected", current, previous, delta,
                    "verticalPerTick=%.2f max=%.2f velocityY=%.2f velocityMax=%.2f".formatted(
                            delta.verticalPerTickAbs(),
                            context.settings().movementMaxVerticalPerTick(),
                            delta.velocityY(),
                            context.settings().movementMaxVerticalBurstPerTick()
                    ));
        }
    }

    private void checkSustainedSpeed(
            AntiCheatCheckContext context,
            MovementState state,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta
    ) {
        if (current.exemptFromMovementChecks()) {
            state.speedBuffer = Math.max(0, state.speedBuffer - 1);
            state.airSpeedBuffer = Math.max(0, state.airSpeedBuffer - 1);
            return;
        }

        double allowedHorizontal = current.onGround()
                ? context.settings().movementMaxSustainedHorizontalPerTick()
                : context.settings().movementMaxAirHorizontalPerTick();
        if (delta.horizontalPerTick() > allowedHorizontal) {
            if (current.onGround()) {
                state.speedBuffer++;
            } else {
                state.airSpeedBuffer++;
            }
        } else {
            state.speedBuffer = Math.max(0, state.speedBuffer - 1);
            state.airSpeedBuffer = Math.max(0, state.airSpeedBuffer - 1);
        }

        if (state.speedBuffer >= context.settings().movementSpeedBufferTicks()) {
            alert(context, state, AntiCheatSeverity.WARNING, "movement_sustained_speed", "Unusual sustained movement speed detected", current, previous, delta,
                    "buffer=%d threshold=%d horizontalPerTick=%.2f max=%.2f sprinting=%s sneaking=%s".formatted(
                            state.speedBuffer,
                            context.settings().movementSpeedBufferTicks(),
                            delta.horizontalPerTick(),
                            allowedHorizontal,
                            current.sprinting(),
                            current.sneaking()
                    ));
            state.speedBuffer = 0;
        }

        if (state.airSpeedBuffer >= context.settings().movementAirSpeedBufferTicks()) {
            alert(context, state, AntiCheatSeverity.WARNING, "movement_air_speed", "Unusual airborne movement speed detected", current, previous, delta,
                    "buffer=%d threshold=%d horizontalPerTick=%.2f max=%.2f airTicks=%d".formatted(
                            state.airSpeedBuffer,
                            context.settings().movementAirSpeedBufferTicks(),
                            delta.horizontalPerTick(),
                            allowedHorizontal,
                            state.airTicks
                    ));
            state.airSpeedBuffer = 0;
        }
    }

    private void checkHover(
            AntiCheatCheckContext context,
            MovementState state,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta
    ) {
        if (current.onGround() || current.exemptFromAirChecks()) {
            state.hoverTicks = 0;
            return;
        }

        if (Math.abs(delta.verticalPerTick()) <= context.settings().movementHoverVerticalPerTick()) {
            state.hoverTicks++;
        } else {
            state.hoverTicks = Math.max(0, state.hoverTicks - 2);
        }

        if (state.hoverTicks < context.settings().movementHoverTicks()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "movement_hover", "Unusual airborne hover detected", current, previous, delta,
                "hoverTicks=%d threshold=%d airTicks=%d verticalPerTick=%.3f max=%.3f horizontalPerTick=%.2f".formatted(
                        state.hoverTicks,
                        context.settings().movementHoverTicks(),
                        state.airTicks,
                        delta.verticalPerTick(),
                        context.settings().movementHoverVerticalPerTick(),
                        delta.horizontalPerTick()
                ));
        state.hoverTicks = 0;
    }

    private void checkFlyAscend(
            AntiCheatCheckContext context,
            MovementState state,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta
    ) {
        if (current.onGround() || current.exemptFromAirChecks()) {
            state.upwardTicks = 0;
            return;
        }

        if (delta.verticalPerTick() > context.settings().movementFlyUpwardPerTick()) {
            state.upwardTicks++;
        } else {
            state.upwardTicks = Math.max(0, state.upwardTicks - 1);
        }

        if (state.upwardTicks < context.settings().movementFlyUpwardTicks()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "movement_fly_ascend", "Unusual airborne ascent detected", current, previous, delta,
                "upwardTicks=%d threshold=%d airTicks=%d verticalPerTick=%.3f min=%.3f".formatted(
                        state.upwardTicks,
                        context.settings().movementFlyUpwardTicks(),
                        state.airTicks,
                        delta.verticalPerTick(),
                        context.settings().movementFlyUpwardPerTick()
                ));
        state.upwardTicks = 0;
    }

    private void checkNoFall(
            AntiCheatCheckContext context,
            MovementState state,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta
    ) {
        if (!current.onGround() || previous.onGround() || current.exemptFromAirChecks()) {
            return;
        }

        boolean enoughDistance = state.accumulatedFallDistance >= context.settings().movementNoFallMinDistance();
        boolean enoughAir = state.airTicks >= context.settings().movementNoFallMinAirTicks();
        boolean suspiciousFallCounter = state.maxObservedFallDistance < 0.5F && current.fallDistance() < 0.5F;
        if (enoughDistance && enoughAir && suspiciousFallCounter) {
            alert(context, state, AntiCheatSeverity.HIGH, "movement_no_fall", "Suspicious fall-damage avoidance detected", current, previous, delta,
                    "airTicks=%d minAirTicks=%d accumulatedFall=%.2f minFall=%.2f maxObservedFallDistance=%.2f currentFallDistance=%.2f".formatted(
                            state.airTicks,
                            context.settings().movementNoFallMinAirTicks(),
                            state.accumulatedFallDistance,
                            context.settings().movementNoFallMinDistance(),
                            state.maxObservedFallDistance,
                            current.fallDistance()
                    ));
        }

        state.airTicks = 0;
        state.hoverTicks = 0;
        state.upwardTicks = 0;
        state.accumulatedFallDistance = 0.0D;
        state.maxObservedFallDistance = 0.0F;
    }

    private void checkWaterWalk(
            AntiCheatCheckContext context,
            MovementState state,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta
    ) {
        if (current.exemptFromMovementChecks()
                || current.onGround()
                || current.touchingWater()
                || current.inLava()
                || current.climbing()
                || current.swimming()
                || current.slowFalling()
                || current.levitation()
                || !current.waterBelow()
                || Math.abs(delta.verticalPerTick()) > context.settings().movementHoverVerticalPerTick()
                || delta.horizontalPerTick() < context.settings().movementWaterWalkMinHorizontalPerTick()) {
            state.waterWalkTicks = Math.max(0, state.waterWalkTicks - 2);
            return;
        }

        state.waterWalkTicks++;
        if (state.waterWalkTicks < context.settings().movementWaterWalkTicks()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "movement_water_walk", "Unusual water-surface movement detected", current, previous, delta,
                "waterWalkTicks=%d threshold=%d horizontalPerTick=%.2f minHorizontal=%.2f verticalPerTick=%.3f".formatted(
                        state.waterWalkTicks,
                        context.settings().movementWaterWalkTicks(),
                        delta.horizontalPerTick(),
                        context.settings().movementWaterWalkMinHorizontalPerTick(),
                        delta.verticalPerTick()
                ));
        state.waterWalkTicks = 0;
    }

    private void checkClipping(
            AntiCheatCheckContext context,
            MovementState state,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta
    ) {
        if (current.exemptFromMovementChecks() || current.hasVehicle() || !current.insideWall()) {
            state.clipTicks = Math.max(0, state.clipTicks - 2);
            return;
        }

        state.clipTicks++;
        if (state.clipTicks < context.settings().movementClipTicks()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "movement_inside_wall", "Unusual in-block movement detected", current, previous, delta,
                "clipTicks=%d threshold=%d horizontalPerTick=%.2f verticalPerTick=%.2f".formatted(
                        state.clipTicks,
                        context.settings().movementClipTicks(),
                        delta.horizontalPerTick(),
                        delta.verticalPerTick()
                ));
        state.clipTicks = 0;
    }

    private void alert(
            AntiCheatCheckContext context,
            MovementState state,
            AntiCheatSeverity severity,
            String reasonCode,
            String publicReason,
            MovementSnapshot current,
            MovementSnapshot previous,
            MovementDelta delta,
            String detail
    ) {
        long lastAlertTick = state.lastAlertTicks.getOrDefault(reasonCode, Long.MIN_VALUE);
        if (context.tick() - lastAlertTick < context.settings().movementAlertCooldownTicks()) {
            return;
        }
        state.lastAlertTicks.put(reasonCode, context.tick());

        context.antiCheatService().handle(context.server(), context.player(), new AntiCheatDetection(
                AntiCheatCategory.MOVEMENT,
                severity,
                reasonCode,
                publicReason,
                "check=%s %s from=%.2f,%.2f,%.2f to=%.2f,%.2f,%.2f horizontal=%.2f vertical=%.2f elapsedTicks=%d onGround=%s airTicks=%d water=%s waterBelow=%s lava=%s climbing=%s gliding=%s vehicle=%s insideWall=%s slowFalling=%s levitation=%s velocity=%.2f,%.2f,%.2f".formatted(
                        id(),
                        detail,
                        previous.x(),
                        previous.y(),
                        previous.z(),
                        current.x(),
                        current.y(),
                        current.z(),
                        delta.horizontal(),
                        delta.vertical(),
                        delta.elapsedTicks(),
                        current.onGround(),
                        state.airTicks,
                        current.touchingWater(),
                        current.waterBelow(),
                        current.inLava(),
                        current.climbing(),
                        current.gliding(),
                        current.hasVehicle(),
                        current.insideWall(),
                        current.slowFalling(),
                        current.levitation(),
                        current.velocityX(),
                        current.velocityY(),
                        current.velocityZ()
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
    }

    private static final class MovementState {
        private MovementSnapshot previousSnapshot;
        private int speedBuffer;
        private int airSpeedBuffer;
        private int airTicks;
        private int hoverTicks;
        private int upwardTicks;
        private int waterWalkTicks;
        private int clipTicks;
        private double accumulatedFallDistance;
        private double maxObservedFallDistance;
        private final Map<String, Long> lastAlertTicks = new HashMap<>();

        private void resetTransientBuffers() {
            speedBuffer = 0;
            airSpeedBuffer = 0;
            airTicks = 0;
            hoverTicks = 0;
            upwardTicks = 0;
            waterWalkTicks = 0;
            clipTicks = 0;
            accumulatedFallDistance = 0.0D;
            maxObservedFallDistance = 0.0F;
        }
    }

    private record MovementSnapshot(
            double x,
            double y,
            double z,
            double velocityX,
            double velocityY,
            double velocityZ,
            boolean onGround,
            boolean creative,
            boolean spectator,
            boolean hasVehicle,
            boolean touchingWater,
            boolean inLava,
            boolean climbing,
            boolean gliding,
            boolean swimming,
            boolean waterBelow,
            boolean insideWall,
            boolean sneaking,
            boolean sprinting,
            boolean slowFalling,
            boolean levitation,
            double fallDistance,
            long tick
    ) {
        static MovementSnapshot capture(ServerPlayerEntity player, long tick) {
            Vec3d velocity = player.getVelocity();
            return new MovementSnapshot(
                    player.getX(),
                    player.getY(),
                    player.getZ(),
                    velocity.x,
                    velocity.y,
                    velocity.z,
                    player.isOnGround(),
                    player.isCreative(),
                    player.isSpectator(),
                    player.hasVehicle(),
                    player.isTouchingWater(),
                    player.isInLava(),
                    player.isClimbing(),
                    player.isGliding(),
                    player.isSwimming(),
                    waterBelow(player),
                    player.isInsideWall(),
                    player.isSneaking(),
                    player.isSprinting(),
                    player.hasStatusEffect(StatusEffects.SLOW_FALLING),
                    player.hasStatusEffect(StatusEffects.LEVITATION),
                    player.fallDistance,
                    tick
            );
        }

        boolean exemptFromMovementChecks() {
            return creative || spectator || hasVehicle || gliding;
        }

        boolean exemptFromAirChecks() {
            return exemptFromMovementChecks() || touchingWater || inLava || climbing || swimming || slowFalling || levitation;
        }

        private static boolean waterBelow(ServerPlayerEntity player) {
            BlockPos below = BlockPos.ofFloored(player.getX(), player.getY() - 0.08D, player.getZ());
            return player.getEntityWorld().getFluidState(below).isIn(FluidTags.WATER);
        }
    }

    private record MovementDelta(
            double horizontal,
            double vertical,
            double horizontalPerTick,
            double verticalPerTick,
            double verticalPerTickAbs,
            double velocityY,
            long elapsedTicks
    ) {
        static MovementDelta between(MovementSnapshot previous, MovementSnapshot current) {
            long elapsedTicks = Math.max(1L, current.tick() - previous.tick());
            double dx = current.x() - previous.x();
            double dz = current.z() - previous.z();
            double horizontal = Math.sqrt(dx * dx + dz * dz);
            double vertical = current.y() - previous.y();
            return new MovementDelta(
                    horizontal,
                    vertical,
                    horizontal / elapsedTicks,
                    vertical / elapsedTicks,
                    Math.abs(vertical) / elapsedTicks,
                    current.velocityY(),
                    elapsedTicks
            );
        }

        double verticalAbs() {
            return Math.abs(vertical);
        }
    }
}
