package com.shd.lifesteal.impl.anticheat;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import net.fabricmc.fabric.api.event.player.AttackBlockCallback;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class InteractionAnomalyCheck implements AntiCheatCheck {
    private final Map<UUID, Queue<InteractionSample>> pendingSamples = new HashMap<>();
    private final Map<UUID, InteractionState> states = new HashMap<>();

    @Override
    public String id() {
        return "interaction_anomaly";
    }

    @Override
    public void register() {
        UseItemCallback.EVENT.register((player, world, hand) -> {
            captureItem(player, world, hand, "use_item");
            return ActionResult.PASS;
        });

        UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> {
            captureBlock(player, world, hand, hitResult, "use_block");
            return ActionResult.PASS;
        });

        UseEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            captureEntity(player, world, hand, entity, "use_entity");
            return ActionResult.PASS;
        });

        AttackBlockCallback.EVENT.register((player, world, hand, pos, direction) -> {
            captureBlock(player, world, hand, pos, "attack_block");
            return ActionResult.PASS;
        });

        AttackEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            captureEntity(player, world, hand, entity, "attack_entity");
            return ActionResult.PASS;
        });
    }

    @Override
    public void tick(AntiCheatCheckContext context) {
        if (!context.settings().interactionChecksEnabled()) {
            return;
        }

        Queue<InteractionSample> samples = pendingSamples.remove(context.player().getUuid());
        if (samples == null) {
            return;
        }

        InteractionState state = states.computeIfAbsent(context.player().getUuid(), ignored -> new InteractionState());
        for (InteractionSample sample : samples) {
            checkReach(context, state, sample);
            checkTiming(context, state, sample);
            checkMenuInteraction(context, state, sample);
            checkSpectatorInteraction(context, state, sample);
        }
    }

    @Override
    public void endServerTick(AntiCheatServerTickContext context) {
        if (!context.settings().enabled() || !context.settings().interactionChecksEnabled()) {
            pendingSamples.clear();
            return;
        }
        pendingSamples.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
        states.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
    }

    private void captureItem(PlayerEntity player, World world, Hand hand, String action) {
        if (world.isClient() || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return;
        }

        addSample(serverPlayer, InteractionSample.capture(serverPlayer, action, hand, serverPlayer.getStackInHand(hand), TargetType.NONE, "none", Vec3d.ZERO, 0.0D));
    }

    private void captureBlock(PlayerEntity player, World world, Hand hand, BlockHitResult hitResult, String action) {
        captureBlock(player, world, hand, hitResult.getBlockPos(), action);
    }

    private void captureBlock(PlayerEntity player, World world, Hand hand, BlockPos pos, String action) {
        if (world.isClient() || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return;
        }

        Vec3d target = pos.toCenterPos();
        double distance = serverPlayer.getEyePos().distanceTo(target);
        String targetName = "block=%d,%d,%d".formatted(pos.getX(), pos.getY(), pos.getZ());
        addSample(serverPlayer, InteractionSample.capture(serverPlayer, action, hand, serverPlayer.getStackInHand(hand), TargetType.BLOCK, targetName, target, distance));
    }

    private void captureEntity(PlayerEntity player, World world, Hand hand, Entity entity, String action) {
        if (world.isClient() || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return;
        }

        Vec3d target = entity.getBoundingBox().getCenter();
        double distance = Math.sqrt(entity.getBoundingBox().squaredMagnitude(serverPlayer.getEyePos()));
        String targetName = "%s:%s".formatted(entity.getType().toString(), entity.getName().getString());
        addSample(serverPlayer, InteractionSample.capture(serverPlayer, action, hand, serverPlayer.getStackInHand(hand), TargetType.ENTITY, targetName, target, distance));
    }

    private void addSample(ServerPlayerEntity player, InteractionSample sample) {
        pendingSamples.computeIfAbsent(player.getUuid(), ignored -> new ArrayDeque<>()).add(sample);
    }

    private void checkReach(AntiCheatCheckContext context, InteractionState state, InteractionSample sample) {
        if (sample.targetType() == TargetType.NONE) {
            return;
        }

        double maxReach = sample.targetType() == TargetType.BLOCK
                ? context.settings().interactionMaxBlockReach()
                : context.settings().interactionMaxEntityReach();
        if (sample.distance() <= maxReach) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "interaction_reach", "Unusual interaction reach detected", sample, "distance=%.2f max=%.2f targetType=%s target=%s".formatted(
                sample.distance(),
                maxReach,
                sample.targetType(),
                sample.targetName()
        ));
    }

    private void checkTiming(AntiCheatCheckContext context, InteractionState state, InteractionSample sample) {
        long previousTick = state.lastInteractionTick;
        state.lastInteractionTick = context.tick();
        long elapsedTicks = context.tick() - previousTick;
        if (previousTick == Long.MIN_VALUE || elapsedTicks >= context.settings().interactionMinIntervalTicks()) {
            state.rapidBuffer = Math.max(0, state.rapidBuffer - 1);
            return;
        }

        state.rapidBuffer++;
        if (state.rapidBuffer < context.settings().interactionRapidBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.WARNING, "interaction_rapid", "Unusual interaction timing detected", sample, "elapsedTicks=%d minTicks=%d rapidBuffer=%d required=%d".formatted(
                elapsedTicks,
                context.settings().interactionMinIntervalTicks(),
                state.rapidBuffer,
                context.settings().interactionRapidBuffer()
        ));
        state.rapidBuffer = 0;
    }

    private void checkMenuInteraction(AntiCheatCheckContext context, InteractionState state, InteractionSample sample) {
        if (!sample.menuOpen()) {
            state.menuBuffer = Math.max(0, state.menuBuffer - 1);
            return;
        }

        state.menuBuffer++;
        if (state.menuBuffer < context.settings().interactionMenuBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.HIGH, "interaction_menu_open", "Unusual interaction while menu is open detected", sample, "menuBuffer=%d required=%d targetType=%s target=%s".formatted(
                state.menuBuffer,
                context.settings().interactionMenuBuffer(),
                sample.targetType(),
                sample.targetName()
        ));
        state.menuBuffer = 0;
    }

    private void checkSpectatorInteraction(AntiCheatCheckContext context, InteractionState state, InteractionSample sample) {
        if (!sample.spectator()) {
            state.spectatorBuffer = Math.max(0, state.spectatorBuffer - 1);
            return;
        }

        state.spectatorBuffer++;
        if (state.spectatorBuffer < context.settings().interactionSpectatorBuffer()) {
            return;
        }

        alert(context, state, AntiCheatSeverity.CRITICAL, "interaction_spectator", "Impossible spectator interaction detected", sample, "spectatorBuffer=%d required=%d targetType=%s target=%s".formatted(
                state.spectatorBuffer,
                context.settings().interactionSpectatorBuffer(),
                sample.targetType(),
                sample.targetName()
        ));
        state.spectatorBuffer = 0;
    }

    private void alert(AntiCheatCheckContext context, InteractionState state, AntiCheatSeverity severity, String reasonCode, String publicReason, InteractionSample sample, String detail) {
        String alertKey = reasonCode + "|" + sample.action() + "|" + sample.targetType();
        long lastAlertTick = state.lastAlertTicks.getOrDefault(alertKey, Long.MIN_VALUE);
        if (context.tick() - lastAlertTick < context.settings().interactionAlertCooldownTicks()) {
            return;
        }
        state.lastAlertTicks.put(alertKey, context.tick());

        context.antiCheatService().handle(context.server(), context.player(), new AntiCheatDetection(
                AntiCheatCategory.INTERACTION,
                severity,
                reasonCode,
                publicReason,
                "check=%s action=%s hand=%s item=%s itemId=%s %s creative=%s spectator=%s menuOpen=%s usingItem=%s blocking=%s player=%.2f,%.2f,%.2f target=%.2f,%.2f,%.2f".formatted(
                        id(),
                        sample.action(),
                        sample.hand(),
                        sample.itemName(),
                        sample.itemId(),
                        detail,
                        sample.creative(),
                        sample.spectator(),
                        sample.menuOpen(),
                        sample.usingItem(),
                        sample.blocking(),
                        sample.playerX(),
                        sample.playerY(),
                        sample.playerZ(),
                        sample.targetX(),
                        sample.targetY(),
                        sample.targetZ()
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
    }

    private enum TargetType {
        NONE,
        BLOCK,
        ENTITY
    }

    private static final class InteractionState {
        private long lastInteractionTick = Long.MIN_VALUE;
        private int rapidBuffer;
        private int menuBuffer;
        private int spectatorBuffer;
        private final Map<String, Long> lastAlertTicks = new HashMap<>();
    }

    private record InteractionSample(
            String action,
            String hand,
            String itemName,
            String itemId,
            TargetType targetType,
            String targetName,
            double distance,
            double playerX,
            double playerY,
            double playerZ,
            double targetX,
            double targetY,
            double targetZ,
            boolean creative,
            boolean spectator,
            boolean menuOpen,
            boolean usingItem,
            boolean blocking
    ) {
        static InteractionSample capture(
                ServerPlayerEntity player,
                String action,
                Hand hand,
                ItemStack stack,
                TargetType targetType,
                String targetName,
                Vec3d target,
                double distance
        ) {
            String itemName = stack.isEmpty() ? "empty" : stack.getName().getString();
            String itemId = stack.isEmpty() ? "empty" : Registries.ITEM.getId(stack.getItem()).toString();
            return new InteractionSample(
                    action,
                    hand.name().toLowerCase(),
                    itemName,
                    itemId,
                    targetType,
                    targetName,
                    distance,
                    player.getX(),
                    player.getY(),
                    player.getZ(),
                    target.x,
                    target.y,
                    target.z,
                    player.isCreative(),
                    player.isSpectator(),
                    player.currentScreenHandler != player.playerScreenHandler,
                    player.isUsingItem(),
                    player.isBlocking()
            );
        }
    }
}
