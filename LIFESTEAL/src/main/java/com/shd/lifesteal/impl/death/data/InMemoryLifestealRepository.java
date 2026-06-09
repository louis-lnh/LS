package com.shd.lifesteal.impl.data;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class InMemoryLifestealRepository implements LifestealRepository {
    private final Map<UUID, PlayerData> players = new ConcurrentHashMap<>();

    @Override
    public Optional<PlayerData> findPlayer(UUID playerId) {
        return Optional.ofNullable(players.get(playerId));
    }

    @Override
    public List<PlayerData> findPlayers() {
        return List.copyOf(players.values());
    }

    @Override
    public PlayerData savePlayer(PlayerData playerData) {
        players.put(playerData.playerId(), playerData);
        return playerData;
    }

    @Override
    public void clearSeasonState() {
        players.clear();
    }
}
