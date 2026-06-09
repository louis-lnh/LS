package com.shd.lifesteal.api;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import net.minecraft.server.MinecraftServer;

public interface LifestealService {
    int startingHearts();

    int maxHearts();

    Optional<PlayerHeartState> heartState(UUID playerId);

    HeartChangeResult setHearts(UUID playerId, int hearts, HeartChangeReason reason);

    HeartChangeResult addHearts(UUID playerId, int amount, HeartChangeReason reason);

    HeartChangeResult removeHearts(UUID playerId, int amount, HeartChangeReason reason);

    boolean isEliminated(UUID playerId);

    GracePeriodSnapshot gracePeriod();

    List<GameplayRoleSnapshot> gameplayRoles(MinecraftServer server);
}
