package com.shd.lifesteal.impl.ui;

import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.api.ui.DragonEggLocationKind;
import com.shd.lifesteal.api.ui.DragonEggUiState;
import com.shd.lifesteal.impl.dragon.DragonEggBeaconEffectHandler;
import com.shd.lifesteal.impl.event.EventTimerService;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.entity.boss.BossBar;
import net.minecraft.entity.boss.ServerBossBar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class LifestealBossbarService {
    private static final long UPDATE_INTERVAL_TICKS = 20L;

    private final GracePeriodService gracePeriodService;
    private final EventTimerService eventTimerService;
    private final DragonEggBeaconEffectHandler dragonEggBeaconEffectHandler;
    private final LifestealUiSettings uiSettings;
    private final ServerBossBar bossBar = new ServerBossBar(
            Text.literal("SHD Lifesteal"),
            BossBar.Color.PURPLE,
            BossBar.Style.PROGRESS
    );
    private long ticks;

    public LifestealBossbarService(
            GracePeriodService gracePeriodService,
            EventTimerService eventTimerService,
            DragonEggBeaconEffectHandler dragonEggBeaconEffectHandler,
            LifestealUiSettings uiSettings
    ) {
        this.gracePeriodService = gracePeriodService;
        this.eventTimerService = eventTimerService;
        this.dragonEggBeaconEffectHandler = dragonEggBeaconEffectHandler;
        this.uiSettings = uiSettings;
    }

    public void register() {
        bossBar.setVisible(false);
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    private void tick(MinecraftServer server) {
        ticks++;
        if (ticks % UPDATE_INTERVAL_TICKS != 0L) {
            return;
        }

        if (!uiSettings.enabled(LifestealUiSettings.BOSSBAR)) {
            hide(server);
            return;
        }

        DragonEggUiState egg = dragonEggBeaconEffectHandler.currentUiState();
        if (egg.kind() != DragonEggLocationKind.ABSENT) {
            show(server, dragonEggText(egg), BossBar.Color.PURPLE, 1.0F);
            return;
        }

        EventTimerService.Snapshot event = eventTimerService.snapshot();
        if (event.active()) {
            show(server, Text.literal((event.paused() ? event.name() + " Paused: " : event.name() + ": ") + TimeText.compact(event.remaining())), BossBar.Color.YELLOW, 1.0F);
            return;
        }

        GracePeriodSnapshot grace = gracePeriodService.snapshot();
        if (grace.active()) {
            show(server, Text.literal((grace.paused() ? "Grace Paused: " : "Grace: ") + TimeText.compact(grace.remaining())), BossBar.Color.BLUE, 1.0F);
            return;
        }

        hide(server);
    }

    private void show(MinecraftServer server, Text name, BossBar.Color color, float percent) {
        bossBar.setName(name);
        bossBar.setColor(color);
        bossBar.setPercent(Math.max(0.0F, Math.min(1.0F, percent)));
        bossBar.setVisible(true);
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            bossBar.addPlayer(player);
        }
    }

    private void hide(MinecraftServer server) {
        bossBar.setVisible(false);
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            bossBar.removePlayer(player);
        }
    }

    private Text dragonEggText(DragonEggUiState egg) {
        String location = egg.exact()
                ? "%s %d %d %d".formatted(egg.world(), egg.x(), egg.y(), egg.z())
                : "near %d %d".formatted(egg.x(), egg.z());
        String label = switch (egg.kind()) {
            case PLACED -> "Dragon Egg placed at ";
            case ITEM_FRAME -> "Dragon Egg framed at ";
            case DROPPED -> "Dragon Egg dropped ";
            case CARRIED -> "Dragon Egg carried ";
            case ABSENT -> "Dragon Egg";
        };
        return Text.literal(label + location);
    }

}
