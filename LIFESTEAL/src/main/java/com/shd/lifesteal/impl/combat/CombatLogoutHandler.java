package com.shd.lifesteal.impl.combat;

import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.api.ui.UiAlertSeverity;
import com.shd.lifesteal.impl.death.DeathResolutionService;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import com.shd.lifesteal.impl.ui.UiNotifier;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;

public final class CombatLogoutHandler {
    private final CombatTagService combatTagService;
    private final DeathResolutionService deathResolutionService;
    private final UiBridgeManager uiBridgeManager;

    public CombatLogoutHandler(CombatTagService combatTagService, DeathResolutionService deathResolutionService, UiBridgeManager uiBridgeManager) {
        this.combatTagService = combatTagService;
        this.deathResolutionService = deathResolutionService;
        this.uiBridgeManager = uiBridgeManager;
    }

    public void register() {
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            if (!combatTagService.isTagged(player.getUuid(), Instant.now())) {
                return;
            }

            Optional<UUID> attacker = combatTagService.recentAttacker(player.getUuid(), Instant.now());
            String attackerName = attacker
                    .map(attackerId -> UiNotifier.playerName(server, attackerId))
                    .orElse("unknown attacker");
            UiNotifier.staffAlert(
                    uiBridgeManager,
                    server,
                    UiAlertSeverity.HIGH,
                    "Combat logout",
                    player.getName().getString() + " logged out while fighting " + attackerName,
                    player.getUuid(),
                    attacker.orElse(null)
            );
            ShdLifestealMod.LOGGER.info("{} logged out while combat tagged; applying combat logout death", player.getName().getString());
            player.getInventory().dropAll();
            deathResolutionService.resolve(player);
        });
    }
}
