package com.shd.lifesteal.impl.heart;

import com.shd.lifesteal.api.PlayerHeartState;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PlayerHeartApplier {
    private final HeartService heartService;

    public PlayerHeartApplier(HeartService heartService) {
        this.heartService = heartService;
    }

    public void applyStoredHearts(ServerPlayerEntity player) {
        PlayerHeartState state = heartService.ensurePlayer(player.getUuid());
        applyHearts(player, state.hearts());
    }

    public void applyHearts(ServerPlayerEntity player, int hearts) {
        EntityAttributeInstance maxHealth = player.getAttributeInstance(EntityAttributes.MAX_HEALTH);
        if (maxHealth == null) {
            return;
        }

        double maxHealthValue = hearts * 2.0D;
        maxHealth.setBaseValue(maxHealthValue);
        if (player.getHealth() > maxHealthValue) {
            player.setHealth((float) maxHealthValue);
        }
    }
}
