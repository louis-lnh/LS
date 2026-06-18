package com.shd.lifesteal.impl.anticheat;

public record AntiCheatDetection(
        AntiCheatCategory category,
        AntiCheatSeverity severity,
        String reasonCode,
        String publicReason,
        String context,
        AntiCheatAction recommendedAction
) {
    public AntiCheatDetection {
        if (category == null) {
            throw new IllegalArgumentException("category is required");
        }
        if (severity == null) {
            throw new IllegalArgumentException("severity is required");
        }
        if (reasonCode == null || reasonCode.isBlank()) {
            throw new IllegalArgumentException("reasonCode is required");
        }
        if (publicReason == null || publicReason.isBlank()) {
            throw new IllegalArgumentException("publicReason is required");
        }
    }
}
