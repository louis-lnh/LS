package com.shd.lifesteal.impl.data;

import java.util.UUID;

public record PlayerData(
        UUID playerId,
        int hearts,
        boolean eliminated,
        int kills,
        int deaths,
        int revivals
) {
    public PlayerData withHearts(int newHearts) {
        return new PlayerData(playerId, newHearts, eliminated, kills, deaths, revivals);
    }

    public PlayerData withEliminated(boolean newEliminated) {
        return new PlayerData(playerId, hearts, newEliminated, kills, deaths, revivals);
    }

    public PlayerData withDeathAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills, deaths + 1, revivals);
    }

    public PlayerData withKillAdded() {
        return new PlayerData(playerId, hearts, eliminated, kills + 1, deaths, revivals);
    }
}
