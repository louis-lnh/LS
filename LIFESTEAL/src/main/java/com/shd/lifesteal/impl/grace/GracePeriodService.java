package com.shd.lifesteal.impl.grace;

import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.impl.config.LifestealConfig;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import java.time.Duration;
import java.time.Instant;

public final class GracePeriodService {
    private final LifestealConfig config;
    private final UiBridgeManager uiBridgeManager;
    private Instant endsAt;
    private Duration pausedRemaining = Duration.ZERO;

    public GracePeriodService(LifestealConfig config, UiBridgeManager uiBridgeManager) {
        this.config = config;
        this.uiBridgeManager = uiBridgeManager;
    }

    public void start(Instant now) {
        endsAt = now.plus(config.gracePeriodDuration());
        pausedRemaining = Duration.ZERO;
        uiBridgeManager.onGracePeriodChanged(snapshot(now));
    }

    public void end(Instant now) {
        endsAt = now;
        pausedRemaining = Duration.ZERO;
        uiBridgeManager.onGracePeriodChanged(snapshot(now));
    }

    public void pause(Instant now) {
        GracePeriodSnapshot current = snapshot(now);
        if (!current.active() || current.paused()) {
            return;
        }

        pausedRemaining = current.remaining();
        endsAt = null;
        uiBridgeManager.onGracePeriodChanged(snapshot(now));
    }

    public void resume(Instant now) {
        if (pausedRemaining.isZero()) {
            return;
        }

        endsAt = now.plus(pausedRemaining);
        pausedRemaining = Duration.ZERO;
        uiBridgeManager.onGracePeriodChanged(snapshot(now));
    }

    public boolean active(Instant now) {
        return snapshot(now).active();
    }

    public GracePeriodSnapshot snapshot() {
        return snapshot(Instant.now());
    }

    public GracePeriodSnapshot snapshot(Instant now) {
        if (!pausedRemaining.isZero()) {
            return new GracePeriodSnapshot(true, true, pausedRemaining);
        }
        if (endsAt == null || !endsAt.isAfter(now)) {
            return new GracePeriodSnapshot(false, false, Duration.ZERO);
        }
        return new GracePeriodSnapshot(true, false, Duration.between(now, endsAt));
    }
}
