package com.shd.lifesteal.impl.anticheat;

import java.util.ArrayDeque;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.minecraft.server.network.ServerPlayerEntity;

public final class MacroActionBurstCheck implements AntiCheatCheck {
    private static final int COMBO_WINDOW_TICKS = 2;
    private static final int HOTBAR_WINDOW_TICKS = 8;
    private static final int HOTBAR_CHANGE_THRESHOLD = 6;
    private static final int ALERT_COOLDOWN_TICKS = 100;
    private static final Map<UUID, ArrayDeque<ActionEvent>> EVENTS = new HashMap<>();

    private final Map<UUID, PlayerState> states = new HashMap<>();

    @Override
    public String id() {
        return "macro_action_burst";
    }

    @Override
    public void tick(AntiCheatCheckContext context) {
        if (!context.settings().enabled() || (!context.settings().inventoryChecksEnabled() && !context.settings().interactionChecksEnabled() && !context.settings().combatChecksEnabled())) {
            return;
        }

        ServerPlayerEntity player = context.player();
        long actionTick = player.getEntityWorld().getTime();
        PlayerState state = states.computeIfAbsent(player.getUuid(), ignored -> new PlayerState());
        recordHotbarChange(player, state, actionTick);

        ArrayDeque<ActionEvent> events = EVENTS.computeIfAbsent(player.getUuid(), ignored -> new ArrayDeque<>());
        prune(events, actionTick, Math.max(COMBO_WINDOW_TICKS, HOTBAR_WINDOW_TICKS));
        checkCombo(context, state, events, actionTick);
        checkHotbarThrash(context, state, events, actionTick);
    }

    @Override
    public void endServerTick(AntiCheatServerTickContext context) {
        EVENTS.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
        states.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
    }

    public static void recordInteraction(ServerPlayerEntity player, String action, String itemId) {
        record(player, ActionType.INTERACTION, action, itemId);
    }

    public static void recordCombat(ServerPlayerEntity player, String targetName) {
        record(player, ActionType.COMBAT, "attack", targetName);
    }

    public static void recordInventoryClick(ServerPlayerEntity player, int slotIndex, int button, String actionType, String itemId) {
        record(player, ActionType.INVENTORY, "slot=%d button=%d action=%s".formatted(slotIndex, button, actionType), itemId);
    }

    public static void recordMovementBurst(ServerPlayerEntity player, double horizontalPerTick, double verticalPerTick, double velocityY) {
        record(player, ActionType.MOVEMENT, "burst", "horizontal=%.2f vertical=%.2f velocityY=%.2f".formatted(horizontalPerTick, verticalPerTick, velocityY));
    }

    private static void record(ServerPlayerEntity player, ActionType type, String action, String detail) {
        EVENTS.computeIfAbsent(player.getUuid(), ignored -> new ArrayDeque<>()).addLast(new ActionEvent(player.getEntityWorld().getTime(), type, action, detail));
    }

    private void recordHotbarChange(ServerPlayerEntity player, PlayerState state, long tick) {
        int selectedSlot = player.getInventory().getSelectedSlot();
        if (state.lastSelectedSlot == Integer.MIN_VALUE) {
            state.lastSelectedSlot = selectedSlot;
            return;
        }
        if (state.lastSelectedSlot == selectedSlot) {
            return;
        }
        int previousSlot = state.lastSelectedSlot;
        state.lastSelectedSlot = selectedSlot;
        EVENTS.computeIfAbsent(player.getUuid(), ignored -> new ArrayDeque<>()).addLast(new ActionEvent(tick, ActionType.HOTBAR, "selectedSlot=%d->%d".formatted(previousSlot, selectedSlot), "held=%s".formatted(player.getMainHandStack().getName().getString())));
    }

    private void checkCombo(AntiCheatCheckContext context, PlayerState state, ArrayDeque<ActionEvent> events, long actionTick) {
        Map<ActionType, Integer> counts = countsSince(events, actionTick - COMBO_WINDOW_TICKS);
        int distinctActionTypes = counts.size();
        int total = counts.values().stream().mapToInt(Integer::intValue).sum();
        boolean hasInventoryTiming = counts.containsKey(ActionType.INVENTORY) || counts.containsKey(ActionType.HOTBAR);
        boolean hasExecutionTiming = counts.containsKey(ActionType.COMBAT) || counts.containsKey(ActionType.INTERACTION);
        boolean hasMovementTiming = counts.containsKey(ActionType.MOVEMENT);
        if (distinctActionTypes < 3 || total < 4 || !hasInventoryTiming || !hasExecutionTiming || !hasMovementTiming) {
            return;
        }

        alert(context, state, "macro_action_combo", "Suspicious multi-action macro pattern detected", events, counts, "windowTicks=%d totalActions=%d distinctActionTypes=%d".formatted(COMBO_WINDOW_TICKS, total, distinctActionTypes));
    }

    private void checkHotbarThrash(AntiCheatCheckContext context, PlayerState state, ArrayDeque<ActionEvent> events, long actionTick) {
        Map<ActionType, Integer> counts = countsSince(events, actionTick - HOTBAR_WINDOW_TICKS);
        int hotbarChanges = counts.getOrDefault(ActionType.HOTBAR, 0);
        if (hotbarChanges < HOTBAR_CHANGE_THRESHOLD) {
            return;
        }

        alert(context, state, "macro_hotbar_thrash", "Suspicious hotbar switching pattern detected", events, counts, "windowTicks=%d hotbarChanges=%d threshold=%d".formatted(HOTBAR_WINDOW_TICKS, hotbarChanges, HOTBAR_CHANGE_THRESHOLD));
    }

    private void alert(AntiCheatCheckContext context, PlayerState state, String reasonCode, String publicReason, ArrayDeque<ActionEvent> events, Map<ActionType, Integer> counts, String detail) {
        long lastAlertTick = state.lastAlertTicks.getOrDefault(reasonCode, Long.MIN_VALUE);
        if (context.tick() - lastAlertTick < ALERT_COOLDOWN_TICKS) {
            return;
        }
        state.lastAlertTicks.put(reasonCode, context.tick());

        context.antiCheatService().handle(context.server(), context.player(), new AntiCheatDetection(
                AntiCheatCategory.INTERACTION,
                AntiCheatSeverity.WARNING,
                reasonCode,
                publicReason,
                "check=%s %s counts=%s recent=%s creative=%s spectator=%s usingItem=%s blocking=%s".formatted(
                        id(),
                        detail,
                        counts,
                        recentEvents(events, context.player().getEntityWorld().getTime() - Math.max(COMBO_WINDOW_TICKS, HOTBAR_WINDOW_TICKS)),
                        context.player().isCreative(),
                        context.player().isSpectator(),
                        context.player().isUsingItem(),
                        context.player().isBlocking()
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
    }

    private static Map<ActionType, Integer> countsSince(ArrayDeque<ActionEvent> events, long oldestTick) {
        Map<ActionType, Integer> counts = new EnumMap<>(ActionType.class);
        for (ActionEvent event : events) {
            if (event.tick() >= oldestTick) {
                counts.merge(event.type(), 1, Integer::sum);
            }
        }
        return counts;
    }

    private static String recentEvents(ArrayDeque<ActionEvent> events, long oldestTick) {
        StringBuilder builder = new StringBuilder();
        int included = 0;
        for (ActionEvent event : events) {
            if (event.tick() < oldestTick) {
                continue;
            }
            if (included > 0) {
                builder.append("; ");
            }
            builder.append(event.type()).append("@").append(event.tick()).append("(").append(event.action()).append(" ").append(event.detail()).append(")");
            included++;
            if (included >= 12) {
                builder.append("; ...");
                break;
            }
        }
        return builder.toString();
    }

    private static void prune(ArrayDeque<ActionEvent> events, long currentTick, long keepTicks) {
        long oldest = currentTick - keepTicks;
        while (!events.isEmpty() && events.peekFirst().tick() < oldest) {
            events.removeFirst();
        }
    }

    private enum ActionType {
        HOTBAR,
        INVENTORY,
        INTERACTION,
        COMBAT,
        MOVEMENT
    }

    private static final class PlayerState {
        private int lastSelectedSlot = Integer.MIN_VALUE;
        private final Map<String, Long> lastAlertTicks = new HashMap<>();
    }

    private record ActionEvent(long tick, ActionType type, String action, String detail) {
    }
}
