package com.shd.lifesteal.impl.death;

import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.heart.DeathResolutionResult;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.item.ModItems;
import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import com.shd.lifesteal.impl.ui.LifestealSoundService;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import com.shd.lifesteal.impl.ui.UiNotifier;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import net.minecraft.entity.Entity;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class DeathResolutionService {
    private static final Text ELIMINATED_MESSAGE = Text.translatable("text.shd-lifesteal.eliminated");

    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;
    private final CombatTagService combatTagService;
    private final ModItems modItems;
    private final UiBridgeManager uiBridgeManager;
    private final LifestealSoundService soundService;

    public DeathResolutionService(
            HeartService heartService,
            PlayerHeartApplier playerHeartApplier,
            CombatTagService combatTagService,
            ModItems modItems,
            UiBridgeManager uiBridgeManager,
            LifestealSoundService soundService
    ) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
        this.combatTagService = combatTagService;
        this.modItems = modItems;
        this.uiBridgeManager = uiBridgeManager;
        this.soundService = soundService;
    }

    public DeathResolutionResult resolve(ServerPlayerEntity victim) {
        return resolve(victim, null);
    }

    public DeathResolutionResult resolve(ServerPlayerEntity victim, DamageSource damageSource) {
        Optional<UUID> creditedKiller = combatTagService.recentAttacker(victim.getUuid(), Instant.now());
        Optional<String> trackedMaceKillKey = trackedMaceKillKey(damageSource, creditedKiller);
        DeathResolutionResult result = heartService.resolveDeath(victim.getUuid(), creditedKiller, trackedMaceKillKey);
        combatTagService.clear(victim.getUuid());
        applySideEffects(victim, result);
        return result;
    }

    private Optional<String> trackedMaceKillKey(DamageSource damageSource, Optional<UUID> creditedKiller) {
        if (damageSource == null || creditedKiller.isEmpty()) {
            return Optional.empty();
        }

        Entity attacker = damageSource.getAttacker();
        if (!(attacker instanceof ServerPlayerEntity player) || !creditedKiller.get().equals(player.getUuid())) {
            return Optional.empty();
        }

        return MaceLimitRules.heldTrackedMaceKey(player);
    }

    private void applySideEffects(ServerPlayerEntity victim, DeathResolutionResult result) {
        if (result.graceProtected()) {
            ShdLifestealMod.LOGGER.debug("Grace protected death for {}", victim.getName().getString());
            return;
        }

        if (result.eliminatedNow()) {
            ShdLifestealMod.LOGGER.info("{} was eliminated at 1 heart", victim.getName().getString());
            UiNotifier.gameplayEvent(
                    uiBridgeManager,
                    server(victim),
                    "player_eliminated",
                    victim.getName().getString() + " was eliminated",
                    victim.getUuid(),
                    result.creditedKiller().orElse(null)
            );
            soundService.playGlobal(server(victim), LifestealSoundService.ELIMINATION);
            victim.networkHandler.disconnect(ELIMINATED_MESSAGE);
            return;
        }

        ShdLifestealMod.LOGGER.info(
                "{} lost one heart on death: {} -> {}",
                victim.getName().getString(),
                result.previousVictimHearts(),
                result.newVictimHearts()
        );
        UiNotifier.playerNotice(uiBridgeManager, victim, "heart_lost", "-1 Heart");

        result.killerHeartResult().ifPresent(killerResult -> {
            ServerPlayerEntity killer = victim.getEntityWorld().getServer().getPlayerManager().getPlayer(killerResult.playerId());
            if (killer != null) {
                playerHeartApplier.applyHearts(killer, killerResult.newHearts());
                UiNotifier.playerNotice(uiBridgeManager, killer, "heart_gained", "+1 Heart");
            }
            ShdLifestealMod.LOGGER.info(
                    "Credited killer {} gained one heart: {} -> {}",
                    killerResult.playerId(),
                    killerResult.previousHearts(),
                    killerResult.newHearts()
            );
            UiNotifier.gameplayEvent(
                    uiBridgeManager,
                    server(victim),
                    "heart_stolen",
                    UiNotifier.playerName(server(victim), killerResult.playerId()) + " stole a heart from " + victim.getName().getString(),
                    killerResult.playerId(),
                    victim.getUuid()
            );
        });

        if (result.dropHeartItemAtDeathLocation()) {
            victim.dropItem(new ItemStack(modItems.heart()), false, true);
            ShdLifestealMod.LOGGER.info("Dropped heart item at {} death location", victim.getName().getString());
            UiNotifier.gameplayEvent(
                    uiBridgeManager,
                    server(victim),
                    "heart_dropped",
                    victim.getName().getString() + " dropped a heart",
                    victim.getUuid(),
                    null
            );
        }
    }

    private MinecraftServer server(ServerPlayerEntity player) {
        return player.getEntityWorld().getServer();
    }
}
