package com.shd.lifesteal.impl.data;

import java.util.Optional;
import java.util.UUID;

public record PlayerData(
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
        long playtimeSeconds
) {
    public PlayerData withHearts(int newHearts) {
        return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains, heartLosses, maceKills, uniqueKills, currentKillstreak, highestKillstreak, maceOneKills, maceTwoKills, playtimeSeconds);
    }

    public PlayerData withHeartChange(int newHearts, boolean trackStats) {
        if (!trackStats) {
            return withHearts(newHearts);
        }

        int delta = newHearts - hearts;
        if (delta > 0) {
            return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains + delta, heartLosses, maceKills, uniqueKills, currentKillstreak, highestKillstreak, maceOneKills, maceTwoKills, playtimeSeconds);
        }
        if (delta < 0) {
            return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains, heartLosses + Math.abs(delta), maceKills, uniqueKills, currentKillstreak, highestKillstreak, maceOneKills, maceTwoKills, playtimeSeconds);
        }
        return withHearts(newHearts);
    }

    public PlayerData withEliminated(boolean newEliminated) {
        return new PlayerData(playerId, hearts, newEliminated, kills, deaths, revivals, heartGains, heartLosses, maceKills, uniqueKills, currentKillstreak, highestKillstreak, maceOneKills, maceTwoKills, playtimeSeconds);
    }

    public PlayerData withDeathAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths + 1, revivals, heartGains, heartLosses, maceKills, uniqueKills, 0, highestKillstreak, maceOneKills, maceTwoKills, playtimeSeconds);
    }

    public PlayerData withKillAdded() {
        return withKillAdded(Optional.empty(), false);
    }

    public PlayerData withKillAdded(Optional<String> maceKey, boolean uniqueKill) {
        int newCurrentKillstreak = currentKillstreak + 1;
        int newMaceKills = maceKey.isPresent() ? maceKills + 1 : maceKills;
        int newMaceOneKills = maceKey.filter("M1"::equals).isPresent() ? maceOneKills + 1 : maceOneKills;
        int newMaceTwoKills = maceKey.filter("M2"::equals).isPresent() ? maceTwoKills + 1 : maceTwoKills;
        return new PlayerData(
                playerId,
                hearts,
                eliminated,
                kills + 1,
                deaths,
                revivals,
                heartGains,
                heartLosses,
                newMaceKills,
                uniqueKill ? uniqueKills + 1 : uniqueKills,
                newCurrentKillstreak,
                Math.max(highestKillstreak, newCurrentKillstreak),
                newMaceOneKills,
                newMaceTwoKills,
                playtimeSeconds
        );
    }

    public PlayerData withRevivalAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths, revivals + 1, heartGains, heartLosses, maceKills, uniqueKills, currentKillstreak, highestKillstreak, maceOneKills, maceTwoKills, playtimeSeconds);
    }

    public PlayerData withPlaytimeAdded(long seconds) {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths, revivals, heartGains, heartLosses, maceKills, uniqueKills, currentKillstreak, highestKillstreak, maceOneKills, maceTwoKills, playtimeSeconds + Math.max(0L, seconds));
    }
}
