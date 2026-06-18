package com.shd.lifesteal.impl.anticheat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public final class AntiCheatCheckRunner {
    private final AntiCheatService antiCheatService;
    private final AntiCheatSettings settings;
    private final List<AntiCheatCheck> checks = new ArrayList<>();
    private long tick;

    public AntiCheatCheckRunner(AntiCheatService antiCheatService, AntiCheatSettings settings) {
        this.antiCheatService = antiCheatService;
        this.settings = settings;
    }

    public void register() {
        registerCheck(new MovementAnomalyCheck());
        registerCheck(new CombatAnomalyCheck());
        registerCheck(new InventoryAnomalyCheck());
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    private void registerCheck(AntiCheatCheck check) {
        checks.add(check);
        check.register();
    }

    private void tick(MinecraftServer server) {
        tick++;

        Set<UUID> onlinePlayers = new HashSet<>();
        List<ServerPlayerEntity> players = server.getPlayerManager().getPlayerList();
        for (ServerPlayerEntity player : players) {
            onlinePlayers.add(player.getUuid());
        }

        if (!settings.enabled()) {
            endServerTick(server, onlinePlayers);
            return;
        }

        for (ServerPlayerEntity player : players) {
            AntiCheatCheckContext context = new AntiCheatCheckContext(server, player, antiCheatService, settings, tick);
            for (AntiCheatCheck check : checks) {
                check.tick(context);
            }
        }

        endServerTick(server, onlinePlayers);
    }

    private void endServerTick(MinecraftServer server, Set<UUID> onlinePlayers) {
        AntiCheatServerTickContext context = new AntiCheatServerTickContext(server, antiCheatService, settings, tick, onlinePlayers);
        for (AntiCheatCheck check : checks) {
            check.endServerTick(context);
        }
    }
}
