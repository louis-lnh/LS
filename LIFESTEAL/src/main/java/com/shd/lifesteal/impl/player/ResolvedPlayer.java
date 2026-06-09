package com.shd.lifesteal.impl.player;

import java.util.Optional;
import java.util.UUID;
import net.minecraft.server.network.ServerPlayerEntity;

public record ResolvedPlayer(UUID playerId, String name, Optional<ServerPlayerEntity> onlinePlayer) {
    public boolean online() {
        return onlinePlayer.isPresent();
    }
}
