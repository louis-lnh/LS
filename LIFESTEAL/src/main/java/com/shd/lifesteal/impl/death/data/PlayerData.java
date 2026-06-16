package com.shd.lifesteal.impl.data;

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
        int maceKills
) {
    public PlayerData withHearts(int newHearts) {
        return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains, heartLosses, maceKills);
    }

    public PlayerData withHeartChange(int newHearts, boolean trackStats) {
        if (!trackStats) {
            return withHearts(newHearts);
        }

        int delta = newHearts - hearts;
        if (delta > 0) {
            return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains + delta, heartLosses, maceKills);
        }
        if (delta < 0) {
            return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains, heartLosses + Math.abs(delta), maceKills);
        }
        return withHearts(newHearts);
    }

    public PlayerData withEliminated(boolean newEliminated) {
        return new PlayerData(playerId, hearts, newEliminated, kills, deaths, revivals, heartGains, heartLosses, maceKills);
    }

    public PlayerData withDeathAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths + 1, revivals, heartGains, heartLosses, maceKills);
    }

    public PlayerData withKillAdded() {
        return withKillAdded(false);
    }

    public PlayerData withKillAdded(boolean maceKill) {
        return new PlayerData(playerId, hearts, eliminated, kills + 1, deaths, revivals, heartGains, heartLosses, maceKill ? maceKills + 1 : maceKills);
    }

    public PlayerData withRevivalAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths, revivals + 1, heartGains, heartLosses, maceKills);
    }
}
