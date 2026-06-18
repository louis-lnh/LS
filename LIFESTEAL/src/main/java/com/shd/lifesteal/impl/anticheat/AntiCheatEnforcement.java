package com.shd.lifesteal.impl.anticheat;

import java.time.Instant;

public record AntiCheatEnforcement(
        AntiCheatAction action,
        String appealId,
        String evidenceId,
        String reasonCode,
        String publicReason,
        Instant expiresAt
) {
    public boolean disconnectsPlayer() {
        return action.disconnectsPlayer();
    }
}
