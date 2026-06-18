package com.shd.lifesteal.impl.death;

import com.shd.lifesteal.impl.elimination.EliminatedPlayerAccess;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.ui.LifestealSoundService;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.entity.event.v1.ServerPlayerEvents;
import net.minecraft.entity.LivingEntity;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PlayerDeathHandler {
    private final PlayerHeartApplier playerHeartApplier;
    private final DeathResolutionService deathResolutionService;
    private final LifestealSoundService soundService;
    private final EliminatedPlayerAccess eliminatedPlayerAccess;

    public PlayerDeathHandler(
            PlayerHeartApplier playerHeartApplier,
            DeathResolutionService deathResolutionService,
            LifestealSoundService soundService,
            EliminatedPlayerAccess eliminatedPlayerAccess
    ) {
        this.playerHeartApplier = playerHeartApplier;
        this.deathResolutionService = deathResolutionService;
        this.soundService = soundService;
        this.eliminatedPlayerAccess = eliminatedPlayerAccess;
    }

    public void register() {
        ServerLivingEntityEvents.AFTER_DEATH.register(this::afterDeath);
        ServerPlayerEvents.AFTER_RESPAWN.register((oldPlayer, newPlayer, alive) -> afterRespawn(newPlayer));
    }

    private void afterRespawn(ServerPlayerEntity player) {
        if (eliminatedPlayerAccess.disconnectIfEliminated(player)) {
            return;
        }

        playerHeartApplier.applyStoredHearts(player);
    }

    private void afterDeath(LivingEntity entity, net.minecraft.entity.damage.DamageSource damageSource) {
        if (!(entity instanceof ServerPlayerEntity player)) {
            return;
        }

        deathResolutionService.resolve(player, damageSource);
        playGlobalDeathSound(player);
    }

    private void playGlobalDeathSound(ServerPlayerEntity deadPlayer) {
        soundService.playGlobal(deadPlayer.getEntityWorld().getServer(), LifestealSoundService.DEATH);
    }
}
