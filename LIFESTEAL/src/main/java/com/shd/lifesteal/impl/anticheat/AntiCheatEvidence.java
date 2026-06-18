package com.shd.lifesteal.impl.anticheat;

import java.time.Instant;
import java.util.UUID;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.BlockPos;

public record AntiCheatEvidence(
        String evidenceId,
        String playerName,
        UUID playerId,
        Instant timestamp,
        String world,
        double x,
        double y,
        double z,
        String context
) {
    public static AntiCheatEvidence capture(ServerPlayerEntity player, String evidenceId, String context) {
        BlockPos blockPos = player.getBlockPos();
        return new AntiCheatEvidence(
                evidenceId,
                player.getName().getString(),
                player.getUuid(),
                Instant.now(),
                "unknown",
                blockPos.getX(),
                blockPos.getY(),
                blockPos.getZ(),
                context == null ? "" : context
        );
    }

    public String summary() {
        return "evidenceId=%s player=%s uuid=%s world=%s pos=%.0f,%.0f,%.0f context=\"%s\"".formatted(
                evidenceId,
                playerName,
                playerId,
                world,
                x,
                y,
                z,
                sanitize(context)
        );
    }

    private static String sanitize(String value) {
        return value.replace('\n', ' ').replace('\r', ' ');
    }
}
