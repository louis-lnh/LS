package com.shd.lifesteal.api;

import java.util.UUID;

public record GameplayRoleSnapshot(
        UUID playerId,
        int hearts,
        boolean eliminated,
        int kills,
        int deaths,
        int revivals,
        int heartGains,
        int heartLosses,
        int maceKills,
        boolean twentyHearts,
        boolean dragonEggHolder,
        boolean maceWielder,
        String maceIdentity
) {
}
