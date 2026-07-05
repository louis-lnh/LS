package com.shd.lifesteal.impl.revival;

import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.api.GameplayRoleSnapshot;
import com.shd.lifesteal.api.PlayerHeartState;
import com.shd.lifesteal.impl.audit.LifestealAuditLog;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.ui.LifestealSoundService;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import com.shd.lifesteal.impl.ui.UiNotifier;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.WorldProperties;

public final class RevivalService {
    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;
    private final LifestealSoundService soundService;
    private final LifestealAuditLog auditLog;
    private final UiBridgeManager uiBridgeManager;
    private final Path pendingTeleportPath;
    private final Set<UUID> pendingSpawnTeleports = new HashSet<>();

    public RevivalService(
            HeartService heartService,
            PlayerHeartApplier playerHeartApplier,
            LifestealSoundService soundService,
            LifestealAuditLog auditLog,
            UiBridgeManager uiBridgeManager,
            Path pendingTeleportPath
    ) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
        this.soundService = soundService;
        this.auditLog = auditLog;
        this.uiBridgeManager = uiBridgeManager;
        this.pendingTeleportPath = pendingTeleportPath;
    }

    public void load() {
        pendingSpawnTeleports.clear();
        if (!Files.exists(pendingTeleportPath)) {
            return;
        }

        Properties properties = new Properties();
        try (Reader reader = Files.newBufferedReader(pendingTeleportPath)) {
            properties.load(reader);
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to load pending revival spawn teleports", exception);
            return;
        }

        for (String key : properties.stringPropertyNames()) {
            if (!Boolean.parseBoolean(properties.getProperty(key))) {
                continue;
            }
            try {
                pendingSpawnTeleports.add(UUID.fromString(key));
            } catch (IllegalArgumentException exception) {
                ShdLifestealMod.LOGGER.warn("Ignoring invalid pending revival teleport UUID: {}", key);
            }
        }
    }

    public void register() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            if (pendingSpawnTeleports.remove(player.getUuid())) {
                savePendingTeleports();
                teleportToSpawn(player);
            }
        });
    }

    public List<GameplayRoleSnapshot> eliminatedPlayers(MinecraftServer server) {
        return heartService.gameplayRoles(server).stream()
                .filter(GameplayRoleSnapshot::eliminated)
                .sorted(Comparator.comparing(role -> UiNotifier.playerName(server, role.playerId()), String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public boolean hasEliminatedPlayers(MinecraftServer server) {
        return !eliminatedPlayers(server).isEmpty();
    }

    public RevivalResult reviveByStaff(MinecraftServer server, UUID targetId, String targetName, String actorName) {
        return revive(server, targetId, targetName, actorName, "staff");
    }

    public RevivalResult reviveByItem(ServerPlayerEntity actor, UUID targetId, String targetName) {
        return revive(actor.getEntityWorld().getServer(), targetId, targetName, actor.getName().getString(), "revival_beacon");
    }

    private RevivalResult revive(MinecraftServer server, UUID targetId, String targetName, String actorName, String source) {
        PlayerHeartState before = heartService.ensurePlayer(targetId);
        if (!before.eliminated()) {
            return RevivalResult.notEliminated(before.hearts());
        }

        PlayerHeartState revived = heartService.revive(targetId);
        ServerPlayerEntity onlineTarget = server.getPlayerManager().getPlayer(targetId);
        if (onlineTarget != null) {
            playerHeartApplier.applyHearts(onlineTarget, revived.hearts());
            teleportToSpawn(onlineTarget);
        } else {
            pendingSpawnTeleports.add(targetId);
            savePendingTeleports();
        }

        String publicMessage = "%s revived %s with a Revival Beacon.".formatted(actorName, targetName);
        server.getPlayerManager().broadcast(Text.literal(publicMessage), false);
        soundService.playGlobal(server, LifestealSoundService.REVIVAL);
        UiNotifier.gameplayEvent(uiBridgeManager, server, "player_revived", publicMessage, targetId, null);
        auditLog.log("revival", "%s revived %s (%s) using %s; hearts=%d".formatted(
                actorName,
                targetName,
                targetId,
                source,
                revived.hearts()
        ));
        ShdLifestealMod.LOGGER.info("{} revived {} ({}) using {}", actorName, targetName, targetId, source);
        return RevivalResult.revived(revived.hearts());
    }

    private void teleportToSpawn(ServerPlayerEntity player) {
        MinecraftServer server = player.getEntityWorld().getServer();
        WorldProperties.SpawnPoint spawnPoint = server.getSpawnPoint();
        ServerWorld spawnWorld = server.getWorld(spawnPoint.getDimension());
        if (spawnWorld == null) {
            spawnWorld = server.getOverworld();
        }

        BlockPos spawnPos = spawnPoint.getPos();
        Vec3d pos = spawnPos.toBottomCenterPos();
        player.teleport(spawnWorld, pos.x, pos.y, pos.z, Set.of(), spawnPoint.yaw(), spawnPoint.pitch(), true);
        playerHeartApplier.applyStoredHearts(player);
    }

    private void savePendingTeleports() {
        Properties properties = new Properties();
        for (UUID playerId : pendingSpawnTeleports) {
            properties.setProperty(playerId.toString(), "true");
        }

        try {
            Files.createDirectories(pendingTeleportPath.getParent());
            try (Writer writer = Files.newBufferedWriter(pendingTeleportPath)) {
                properties.store(writer, "SHD Lifesteal players revived offline and awaiting spawn teleport");
            }
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to save pending revival spawn teleports", exception);
        }
    }

    public record RevivalResult(boolean revived, boolean targetEliminated, int hearts) {
        static RevivalResult revived(int hearts) {
            return new RevivalResult(true, true, hearts);
        }

        static RevivalResult notEliminated(int hearts) {
            return new RevivalResult(false, false, hearts);
        }
    }
}
