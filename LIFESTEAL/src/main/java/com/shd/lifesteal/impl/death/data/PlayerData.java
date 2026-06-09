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
        int heartLosses
) {
    public PlayerData withHearts(int newHearts) {
        return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains, heartLosses);
    }

    public PlayerData withHeartChange(int newHearts, boolean trackStats) {
        if (!trackStats) {
            return withHearts(newHearts);
        }

        int delta = newHearts - hearts;
        if (delta > 0) {
            return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains + delta, heartLosses);
        }
        if (delta < 0) {
            return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals, heartGains, heartLosses + Math.abs(delta));
        }
        return withHearts(newHearts);
    }

    public PlayerData withEliminated(boolean newEliminated) {
        return new PlayerData(playerId, hearts, newEliminated, kills, deaths, revivals, heartGains, heartLosses);
    }

    public PlayerData withDeathAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths + 1, revivals, heartGains, heartLosses);
    }

    public PlayerData withKillAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills + 1, deaths, revivals, heartGains, heartLosses);
    }

    public PlayerData withRevivalAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths, revivals + 1, heartGains, heartLosses);
    }
}
