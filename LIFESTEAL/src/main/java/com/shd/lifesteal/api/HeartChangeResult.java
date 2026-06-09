package com.shd.lifesteal.api;

import java.util.UUID;

public record HeartChangeResult(
        UUID playerId,
        int previousHearts,
        int newHearts,
        HeartChangeReason reason,
        boolean changed
) {
}
