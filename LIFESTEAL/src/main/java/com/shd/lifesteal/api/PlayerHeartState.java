package com.shd.lifesteal.api;

import java.util.UUID;

public record PlayerHeartState(UUID playerId, int hearts, boolean eliminated) {
}
