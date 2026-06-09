package com.shd.lifesteal.impl.ui;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

public final class TimeText {
    private TimeText() {
    }

    public static String compact(Duration duration) {
        return compactSeconds(duration.toSeconds());
    }

    public static String compactSeconds(long totalSeconds) {
        long clamped = Math.max(0L, totalSeconds);
        long days = clamped / 86_400L;
        long hours = (clamped % 86_400L) / 3_600L;
        long minutes = (clamped % 3_600L) / 60L;
        long seconds = clamped % 60L;

        List<String> parts = new ArrayList<>(4);
        if (days > 0L) {
            parts.add(days + "d");
        }
        if (hours > 0L) {
            parts.add(hours + "h");
        }
        if (minutes > 0L) {
            parts.add(minutes + "m");
        }
        if (seconds > 0L || parts.isEmpty()) {
            parts.add(seconds + "s");
        }
        return String.join(" ", parts);
    }
}
