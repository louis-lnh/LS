package com.shd.lifesteal.impl.connection;

import com.shd.lifesteal.impl.ui.UiBridgeManager;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class JoinLeaveMessageHandler {
    private final UiBridgeManager uiBridgeManager;

    public JoinLeaveMessageHandler(UiBridgeManager uiBridgeManager) {
        this.uiBridgeManager = uiBridgeManager;
    }

    public void register() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            if (!uiBridgeManager.isFeatureEnabled("join_leave_messages")) {
                return;
            }

            ServerPlayerEntity player = handler.getPlayer();
            server.getPlayerManager().broadcast(Text.literal("[+] ")
                    .formatted(Formatting.GREEN)
                    .append(Text.literal(player.getName().getString()).formatted(Formatting.WHITE)), false);
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            if (!uiBridgeManager.isFeatureEnabled("join_leave_messages")) {
                return;
            }

            ServerPlayerEntity player = handler.getPlayer();
            server.getPlayerManager().broadcast(Text.literal("[-] ")
                    .formatted(Formatting.RED)
                    .append(Text.literal(player.getName().getString()).formatted(Formatting.WHITE)), false);
        });
    }
}
