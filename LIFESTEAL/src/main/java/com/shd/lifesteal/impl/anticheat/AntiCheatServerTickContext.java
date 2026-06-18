package com.shd.lifesteal.impl.anticheat;

import java.util.Set;
import java.util.UUID;
import net.minecraft.server.MinecraftServer;

public record AntiCheatServerTickContext(
        MinecraftServer server,
        AntiCheatService antiCheatService,
        AntiCheatSettings settings,
        long tick,
        Set<UUID> onlinePlayers
) {
}
