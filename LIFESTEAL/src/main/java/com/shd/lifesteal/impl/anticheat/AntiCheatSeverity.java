package com.shd.lifesteal.impl.anticheat;

public enum AntiCheatSeverity {
    INFO,
    WARNING,
    HIGH,
    CRITICAL;

    public static AntiCheatSeverity parse(String value, AntiCheatSeverity fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return AntiCheatSeverity.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
    }
}
