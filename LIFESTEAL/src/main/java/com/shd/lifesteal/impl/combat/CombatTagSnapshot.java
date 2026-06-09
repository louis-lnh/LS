package com.shd.lifesteal.impl.combat;

import java.util.UUID;

public record CombatTagSnapshot(UUID playerId, UUID recentAttacker, int remainingSeconds) {
}
