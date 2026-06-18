package com.shd.lifesteal.impl.elimination;

import com.shd.lifesteal.impl.heart.HeartService;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class EliminatedPlayerAccess {
    private static final Text ELIMINATED_MESSAGE = Text.translatable("text.shd-lifesteal.eliminated");

    private final HeartService heartService;

    public EliminatedPlayerAccess(HeartService heartService) {
        this.heartService = heartService;
    }

    public boolean disconnectIfEliminated(ServerPlayerEntity player) {
        heartService.ensurePlayer(player.getUuid());
        if (!heartService.isEliminated(player.getUuid())) {
            return false;
        }

        player.networkHandler.disconnect(ELIMINATED_MESSAGE);
        return true;
    }
}
