package com.shd.lifesteal.impl.anticheat;

public enum AntiCheatAction {
    AUDIT_ONLY(false),
    BLOCK_ACTION(false),
    REVERT_STATE(false),
    STAFF_REVIEW_REQUIRED(false),
    KICK(true),
    TEMP_BAN(true),
    PERMANENT_BAN(true);

    private final boolean disconnectsPlayer;

    AntiCheatAction(boolean disconnectsPlayer) {
        this.disconnectsPlayer = disconnectsPlayer;
    }

    public boolean disconnectsPlayer() {
        return disconnectsPlayer;
    }

    public static AntiCheatAction parse(String value, AntiCheatAction fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        try {
            return AntiCheatAction.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
    }
}
