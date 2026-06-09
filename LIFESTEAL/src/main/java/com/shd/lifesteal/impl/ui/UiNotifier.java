package com.shd.lifesteal.impl.ui;

import com.shd.lifesteal.api.ui.LifestealUiAlert;
import com.shd.lifesteal.api.ui.LifestealUiEvent;
import com.shd.lifesteal.api.ui.PlayerUiNotice;
import com.shd.lifesteal.api.ui.UiAlertSeverity;
import java.util.UUID;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.PlayerConfigEntry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class UiNotifier {
    private UiNotifier() {
    }

    public static void playerNotice(UiBridgeManager uiBridgeManager, ServerPlayerEntity player, String type, String message) {
        uiBridgeManager.onPlayerNotice(new PlayerUiNotice(player.getUuid(), type, message));
        LifestealActionbar.notify(player, Text.literal(message).formatted(noticeFormatting(type)));
    }

    public static void gameplayEvent(UiBridgeManager uiBridgeManager, MinecraftServer server, String type, String message, UUID primaryPlayer, UUID secondaryPlayer) {
        uiBridgeManager.onGameplayEvent(new LifestealUiEvent(type, message, primaryPlayer, secondaryPlayer));
        server.getPlayerManager()
                .getPlayerList()
                .forEach(player -> player.sendMessage(Text.literal(message).formatted(Formatting.GOLD), false));
    }

    public static void staffAlert(
            UiBridgeManager uiBridgeManager,
            MinecraftServer server,
            UiAlertSeverity severity,
            String title,
            String message,
            UUID actor,
            UUID target
    ) {
        uiBridgeManager.onStaffAlert(new LifestealUiAlert(severity, title, message, actor, target));
        Text text = Text.literal("[SHD " + severity.name() + "] " + title + ": " + message).formatted(formatting(severity));
        server.getPlayerManager()
                .getPlayerList()
                .stream()
                .filter(player -> server.getPlayerManager().isOperator(new PlayerConfigEntry(player.getGameProfile())))
                .forEach(player -> player.sendMessage(text, false));
    }

    public static String playerName(MinecraftServer server, UUID playerId) {
        ServerPlayerEntity player = server.getPlayerManager().getPlayer(playerId);
        if (player != null) {
            return player.getName().getString();
        }
        return playerId.toString();
    }

    private static Formatting formatting(UiAlertSeverity severity) {
        return switch (severity) {
            case LOW -> Formatting.GRAY;
            case MEDIUM -> Formatting.YELLOW;
            case HIGH -> Formatting.RED;
            case CRITICAL -> Formatting.DARK_RED;
        };
    }

    private static Formatting noticeFormatting(String type) {
        return switch (type) {
            case "heart_gained" -> Formatting.GREEN;
            case "heart_lost" -> Formatting.RED;
            case "disabled_feature" -> Formatting.YELLOW;
            default -> Formatting.WHITE;
        };
    }
}
