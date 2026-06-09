package com.shd.lifesteal.impl.grace;

import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import com.shd.lifesteal.impl.ui.UiNotifier;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.MinecraftServer;

public final class GraceWarningPublisher {
    private static final List<Long> WARNING_SECONDS = List.of(600L, 300L, 60L, 10L);

    private final GracePeriodService gracePeriodService;
    private final UiBridgeManager uiBridgeManager;
    private final Set<Long> sentWarnings = new HashSet<>();
    private boolean sentEnded;
    private boolean wasActive;
    private long ticks;

    public GraceWarningPublisher(GracePeriodService gracePeriodService, UiBridgeManager uiBridgeManager) {
        this.gracePeriodService = gracePeriodService;
        this.uiBridgeManager = uiBridgeManager;
    }

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    private void tick(MinecraftServer server) {
        ticks++;
        if (ticks % 20L != 0L) {
            return;
        }

        GracePeriodSnapshot snapshot = gracePeriodService.snapshot();
        uiBridgeManager.onGracePeriodChanged(snapshot);
        if (!uiBridgeManager.isFeatureEnabled("grace_warnings")) {
            return;
        }

        if (snapshot.active() && !snapshot.paused()) {
            wasActive = true;
            sentEnded = false;
            long remainingSeconds = snapshot.remaining().toSeconds();
            for (long warningSecond : WARNING_SECONDS) {
                if (remainingSeconds <= warningSecond && sentWarnings.add(warningSecond)) {
                    String message = "Grace period ends in " + format(Duration.ofSeconds(warningSecond));
                    UiNotifier.gameplayEvent(uiBridgeManager, server, "grace_warning", message, null, null);
                }
            }
            return;
        }

        if (!snapshot.active()) {
            sentWarnings.clear();
            if (wasActive && !sentEnded) {
                sentEnded = true;
                wasActive = false;
                UiNotifier.gameplayEvent(uiBridgeManager, server, "grace_ended", "Grace Period Ended", null, null);
            }
        }
    }

    private static String format(Duration duration) {
        long seconds = duration.toSeconds();
        if (seconds >= 60L) {
            return (seconds / 60L) + " minute" + (seconds == 60L ? "" : "s");
        }
        return seconds + " seconds";
    }
}
