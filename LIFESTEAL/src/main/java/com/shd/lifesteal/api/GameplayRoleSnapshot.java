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
        int uniqueKills,
        int currentKillstreak,
        int highestKillstreak,
        int maceOneKills,
        int maceTwoKills,
        long playtimeSeconds,
        boolean twentyHearts,
        boolean dragonEggHolder,
        boolean maceWielder,
        String maceIdentity
) {
}
