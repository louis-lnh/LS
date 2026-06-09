package com.shd.lifesteal.impl.event;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.Properties;

public final class EventTimerService {
    private static final String KEY_NAME = "name";
    private static final String KEY_ENDS_AT = "endsAt";
    private static final String KEY_PAUSED_REMAINING_MILLIS = "pausedRemainingMillis";

    private final Path statePath;
    private String name = "";
    private Instant endsAt;
    private Duration pausedRemaining;

    public EventTimerService(Path statePath) {
        this.statePath = statePath;
    }

    public void load() {
        if (!Files.exists(statePath)) {
            return;
        }

        Properties properties = new Properties();
        try (InputStream input = Files.newInputStream(statePath)) {
            properties.load(input);
            this.name = properties.getProperty(KEY_NAME, "").trim();
            String pausedMillis = properties.getProperty(KEY_PAUSED_REMAINING_MILLIS, "").trim();
            String endsAtValue = properties.getProperty(KEY_ENDS_AT, "").trim();
            if (!pausedMillis.isEmpty()) {
                this.pausedRemaining = Duration.ofMillis(Long.parseLong(pausedMillis));
                this.endsAt = null;
            } else if (!endsAtValue.isEmpty()) {
                this.endsAt = Instant.parse(endsAtValue);
                this.pausedRemaining = null;
            }
            if (this.name.isBlank() || (this.endsAt == null && this.pausedRemaining == null)) {
                end();
            }
        } catch (RuntimeException | java.io.IOException exception) {
            end();
        }
    }

    public void start(String eventName, Duration duration, Instant now) {
        this.name = eventName == null || eventName.isBlank() ? "Event" : eventName.trim();
        this.endsAt = now.plus(duration);
        this.pausedRemaining = null;
        save();
    }

    public void end() {
        this.name = "";
        this.endsAt = null;
        this.pausedRemaining = null;
        save();
    }

    public void pause(Instant now) {
        Snapshot snapshot = snapshot(now);
        if (!snapshot.active() || snapshot.paused()) {
            return;
        }
        this.pausedRemaining = snapshot.remaining();
        this.endsAt = null;
        save();
    }

    public void resume(Instant now) {
        if (pausedRemaining == null) {
            return;
        }
        this.endsAt = now.plus(pausedRemaining);
        this.pausedRemaining = null;
        save();
    }

    public Snapshot snapshot() {
        return snapshot(Instant.now());
    }

    public Snapshot snapshot(Instant now) {
        if (pausedRemaining != null) {
            return new Snapshot(true, true, name, pausedRemaining);
        }
        if (endsAt == null) {
            return Snapshot.inactive();
        }
        Duration remaining = Duration.between(now, endsAt);
        if (!remaining.isPositive()) {
            end();
            return Snapshot.inactive();
        }
        return new Snapshot(true, false, name, remaining);
    }

    public Optional<String> activeName() {
        Snapshot snapshot = snapshot();
        return snapshot.active() ? Optional.of(snapshot.name()) : Optional.empty();
    }

    public record Snapshot(boolean active, boolean paused, String name, Duration remaining) {
        public static Snapshot inactive() {
            return new Snapshot(false, false, "", Duration.ZERO);
        }
    }

    private void save() {
        try {
            Files.createDirectories(statePath.getParent());
            if (name.isBlank() || (endsAt == null && pausedRemaining == null)) {
                Files.deleteIfExists(statePath);
                return;
            }

            Properties properties = new Properties();
            properties.setProperty(KEY_NAME, name);
            if (pausedRemaining != null) {
                properties.setProperty(KEY_PAUSED_REMAINING_MILLIS, Long.toString(pausedRemaining.toMillis()));
            } else if (endsAt != null) {
                properties.setProperty(KEY_ENDS_AT, endsAt.toString());
            }

            try (OutputStream output = Files.newOutputStream(statePath)) {
                properties.store(output, "SHD Lifesteal event timer state");
            }
        } catch (java.io.IOException ignored) {
        }
    }
}
