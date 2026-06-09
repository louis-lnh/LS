package com.shd.lifesteal.impl.ui;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.sound.SoundEvent;
import net.minecraft.sound.SoundEvents;

public final class LifestealSoundService {
    public static final String DEATH = "death";
    public static final String ELIMINATION = "elimination";
    public static final String REVIVAL = "revival";

    private final LifestealUiSettings uiSettings;

    public LifestealSoundService(LifestealUiSettings uiSettings) {
        this.uiSettings = uiSettings;
    }

    public void playGlobal(MinecraftServer server, String type) {
        if (!uiSettings.enabled(LifestealUiSettings.SOUNDS)) {
            return;
        }

        SoundEvent sound = sound(uiSettings.sound(type));
        if (sound == null) {
            return;
        }

        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            player.playSound(sound, 1.0F, 1.0F);
        }
    }

    private SoundEvent sound(String key) {
        return switch (key) {
            case "off", "none", "" -> null;
            case "wither_death", "minecraft:entity.wither.death" -> SoundEvents.ENTITY_WITHER_DEATH;
            case "beacon_activate", "minecraft:block.beacon.activate" -> SoundEvents.BLOCK_BEACON_ACTIVATE;
            case "totem_use", "minecraft:item.totem.use" -> SoundEvents.ITEM_TOTEM_USE;
            case "player_levelup", "minecraft:entity.player.levelup" -> SoundEvents.ENTITY_PLAYER_LEVELUP;
            case "end_portal_spawn", "minecraft:block.end_portal.spawn" -> SoundEvents.BLOCK_END_PORTAL_SPAWN;
            case "ender_dragon_growl", "minecraft:entity.ender_dragon.growl" -> SoundEvents.ENTITY_ENDER_DRAGON_GROWL;
            case "warden_death", "minecraft:entity.warden.death" -> SoundEvents.ENTITY_WARDEN_DEATH;
            default -> SoundEvents.ENTITY_WITHER_SPAWN;
        };
    }
}
