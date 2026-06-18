package com.shd.lifesteal.impl.data;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LifestealRepository {
    Optional<PlayerData> findPlayer(UUID playerId);

    List<PlayerData> findPlayers();

    PlayerData savePlayer(PlayerData playerData);

    boolean recordUniqueKill(UUID killerId, UUID victimId);

    void clearSeasonState();
}
