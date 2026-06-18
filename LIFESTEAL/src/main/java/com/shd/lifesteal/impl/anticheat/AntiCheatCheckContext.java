package com.shd.lifesteal.impl.anticheat;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public record AntiCheatCheckContext(
        MinecraftServer server,
        ServerPlayerEntity player,
        AntiCheatService antiCheatService,
        AntiCheatSettings settings,
        long tick
) {
}
