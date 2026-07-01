package com.shd.lifesteal.impl.death;

import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.impl.anticheat.AntiCheatAction;
import com.shd.lifesteal.impl.anticheat.AntiCheatCategory;
import com.shd.lifesteal.impl.anticheat.AntiCheatDetection;
import com.shd.lifesteal.impl.anticheat.AntiCheatService;
import com.shd.lifesteal.impl.anticheat.AntiCheatSeverity;
import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.heart.DeathResolutionResult;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.item.ModItems;
import com.shd.lifesteal.impl.restriction.ElytraCombatCooldownService;
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
    private final ElytraCombatCooldownService elytraCombatCooldownService;
    private final AntiCheatService antiCheatService;

    public DeathResolutionService(
            HeartService heartService,
            PlayerHeartApplier playerHeartApplier,
            CombatTagService combatTagService,
            ModItems modItems,
            UiBridgeManager uiBridgeManager,
            LifestealSoundService soundService,
            ElytraCombatCooldownService elytraCombatCooldownService,
            AntiCheatService antiCheatService
    ) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
        this.combatTagService = combatTagService;
        this.modItems = modItems;
        this.uiBridgeManager = uiBridgeManager;
        this.soundService = soundService;
        this.elytraCombatCooldownService = elytraCombatCooldownService;
        this.antiCheatService = antiCheatService;
    }

    public DeathResolutionResult resolve(ServerPlayerEntity victim) {
        return resolve(victim, null);
    }

    public DeathResolutionResult resolve(ServerPlayerEntity victim, DamageSource damageSource) {
        Optional<UUID> creditedKiller = combatTagService.recentAttacker(victim.getUuid(), Instant.now());
        Optional<String> trackedMaceKillKey = trackedMaceKillKey(damageSource, creditedKiller);
        reviewTrackedMaceKill(victim, damageSource, creditedKiller, trackedMaceKillKey);
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

    private void reviewTrackedMaceKill(
            ServerPlayerEntity victim,
            DamageSource damageSource,
            Optional<UUID> creditedKiller,
            Optional<String> trackedMaceKillKey
    ) {
        if (damageSource == null || creditedKiller.isEmpty() || trackedMaceKillKey.isEmpty()) {
            return;
        }

        Entity attacker = damageSource.getAttacker();
        if (!(attacker instanceof ServerPlayerEntity playerAttacker) || !creditedKiller.get().equals(playerAttacker.getUuid())) {
            return;
        }

        Instant now = Instant.now();
        boolean mobilityCooldownActive = elytraCombatCooldownService.isActive(playerAttacker.getUuid(), now);
        ElytraCombatCooldownService.MobilitySnapshot mobility = elytraCombatCooldownService.mobilitySnapshot(playerAttacker.getUuid(), now);
        boolean gliding = playerAttacker.isGliding();
        boolean airborne = !playerAttacker.isOnGround();
        boolean highFall = playerAttacker.fallDistance >= 6.0F;
        boolean fastDrop = playerAttacker.getVelocity().y < -0.65D;
        if (!mobilityCooldownActive && !gliding && !mobility.recentlyGliding() && !mobility.recentlyFastFalling() && !(airborne && (highFall || fastDrop))) {
            return;
        }

        antiCheatService.handle(server(victim), playerAttacker, new AntiCheatDetection(
                AntiCheatCategory.COMBAT_TAG,
                AntiCheatSeverity.HIGH,
                "lifesteal_mobility_assisted_mace_kill",
                "Mobility-assisted event mace kill requires review",
                "check=lifesteal_mobility_assisted_mace_kill attacker=%s attackerUuid=%s victim=%s victimUuid=%s mace=%s mobilityCooldown=%s gliding=%s recentlyGliding=%s recentlyFastFalling=%s airborne=%s fallDistance=%.2f velocity=%.2f,%.2f,%.2f attackerPos=%.1f,%.1f,%.1f victimPos=%.1f,%.1f,%.1f damage=%s".formatted(
                        playerAttacker.getName().getString(),
                        playerAttacker.getUuidAsString(),
                        victim.getName().getString(),
                        victim.getUuidAsString(),
                        trackedMaceKillKey.get(),
                        mobilityCooldownActive,
                        gliding,
                        mobility.recentlyGliding(),
                        mobility.recentlyFastFalling(),
                        airborne,
                        playerAttacker.fallDistance,
                        playerAttacker.getVelocity().x,
                        playerAttacker.getVelocity().y,
                        playerAttacker.getVelocity().z,
                        playerAttacker.getX(),
                        playerAttacker.getY(),
                        playerAttacker.getZ(),
                        victim.getX(),
                        victim.getY(),
                        victim.getZ(),
                        damageSource.getName()
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
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
