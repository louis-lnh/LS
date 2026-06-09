package com.shd.lifesteal.impl.combat;

import java.time.Instant;
import java.util.UUID;

public record CombatTag(UUID playerId, UUID recentAttacker, Instant expiresAt) {
    public boolean expired(Instant now) {
        return !expiresAt.isAfter(now);
    }
}
