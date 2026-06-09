package com.shd.lifesteal.impl.elimination;

import com.shd.lifesteal.impl.data.LifestealRepository;
import java.util.UUID;

public final class EliminationService {
    private final LifestealRepository repository;

    public EliminationService(LifestealRepository repository) {
        this.repository = repository;
    }

    public boolean isEliminated(UUID playerId) {
        return repository.findPlayer(playerId).map(player -> player.eliminated()).orElse(false);
    }

    public void eliminate(UUID playerId) {
        repository.findPlayer(playerId)
                .map(player -> player.withEliminated(true))
                .ifPresent(repository::savePlayer);
    }

    public void revive(UUID playerId, int revivalHearts) {
        repository.findPlayer(playerId)
                .map(player -> player.withEliminated(false).withHearts(revivalHearts))
                .ifPresent(repository::savePlayer);
    }
}
