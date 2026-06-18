package com.shd.lifesteal.impl.anticheat;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

public enum AntiCheatCaseStatus {
    OPEN,
    WATCHING,
    REVIEWED,
    FALSE_POSITIVE,
    ESCALATED,
    ACTIONED;

    public static AntiCheatCaseStatus parse(String value, AntiCheatCaseStatus fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        String normalized = value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        for (AntiCheatCaseStatus status : values()) {
            if (status.name().equals(normalized)) {
                return status;
            }
        }
        return fallback;
    }

    public static List<String> suggestions() {
        return Arrays.stream(values())
                .map(status -> status.name().toLowerCase(Locale.ROOT))
                .toList();
    }

    public boolean unresolved() {
        return this == OPEN || this == WATCHING || this == ESCALATED;
    }
}
