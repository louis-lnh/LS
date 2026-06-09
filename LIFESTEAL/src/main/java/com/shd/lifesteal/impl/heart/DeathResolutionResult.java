package com.shd.lifesteal.impl.heart;

import com.shd.lifesteal.api.HeartChangeResult;
import java.util.Optional;
import java.util.UUID;

public record DeathResolutionResult(
        UUID victim,
        int previousVictimHearts,
        int newVictimHearts,
        boolean eliminatedNow,
        boolean eliminated,
        boolean graceProtected,
        Optional<UUID> creditedKiller,
        Optional<HeartChangeResult> killerHeartResult,
        boolean dropHeartItemAtDeathLocation
) {
}
