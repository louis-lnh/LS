package com.shd.lifesteal.impl.ui;

import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.event.EventTimerService;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.network.packet.s2c.play.OverlayMessageS2CPacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class LifestealActionbar {
    private static final long NOTIFICATION_MILLIS = 2200L;
    private static final Map<UUID, Notification> NOTIFICATIONS = new ConcurrentHashMap<>();

    private final GracePeriodService gracePeriodService;
    private final CombatTagService combatTagService;
    private final EventTimerService eventTimerService;
    private final LifestealUiSettings uiSettings;
    private long ticks;

    public LifestealActionbar(
            GracePeriodService gracePeriodService,
            CombatTagService combatTagService,
            EventTimerService eventTimerService,
            LifestealUiSettings uiSettings
    ) {
        this.gracePeriodService = gracePeriodService;
        this.combatTagService = combatTagService;
        this.eventTimerService = eventTimerService;
        this.uiSettings = uiSettings;
    }

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    public static void notify(ServerPlayerEntity player, Text text) {
        NOTIFICATIONS.put(player.getUuid(), new Notification(text, System.currentTimeMillis() + NOTIFICATION_MILLIS));
        send(player, text);
    }

    private void tick(MinecraftServer server) {
        ticks++;
        if (ticks % 20L != 0L) {
            return;
        }
        if (!uiSettings.enabled(LifestealUiSettings.ACTIONBAR)) {
            return;
        }

        Instant now = Instant.now();
        GracePeriodSnapshot grace = gracePeriodService.snapshot(now);
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            Text text = notification(player.getUuid());
            if (text == null) {
                text = timerText(player, grace, now);
            }
            if (text != null) {
                send(player, text);
            }
        }
    }

    private static Text notification(UUID playerId) {
        Notification notification = NOTIFICATIONS.get(playerId);
        if (notification == null) {
            return null;
        }

        if (notification.expiresAtMillis() <= System.currentTimeMillis()) {
            NOTIFICATIONS.remove(playerId);
            return null;
        }
        return notification.text();
    }

    private Text timerText(ServerPlayerEntity player, GracePeriodSnapshot grace, Instant now) {
        return combatTagService.snapshot(player.getUuid(), now)
                .map(tag -> Text.literal("Combat: " + formatSeconds(tag.remainingSeconds())).formatted(Formatting.RED))
                .orElseGet(() -> {
                    EventTimerService.Snapshot event = eventTimerService.snapshot(now);
                    if (event.active()) {
                        return Text.literal((event.paused() ? event.name() + " paused: " : event.name() + ": ") + TimeText.compact(event.remaining()))
                                .formatted(Formatting.GOLD);
                    }
                    if (grace.active()) {
                        return Text.literal((grace.paused() ? "Grace paused: " : "Grace: ") + TimeText.compact(grace.remaining())).formatted(Formatting.AQUA);
                    }
                    return null;
                });
    }

    private static void send(ServerPlayerEntity player, Text text) {
        player.networkHandler.sendPacket(new OverlayMessageS2CPacket(text));
    }

    private static String formatSeconds(long totalSeconds) {
        long clamped = Math.max(0L, totalSeconds);
        long hours = clamped / 3600L;
        long minutes = (clamped % 3600L) / 60L;
        long seconds = clamped % 60L;
        if (hours > 0L) {
            return "%02d:%02d:%02d".formatted(hours, minutes, seconds);
        }
        return "%02d:%02d".formatted(minutes, seconds);
    }

    private record Notification(Text text, long expiresAtMillis) {
    }
}
