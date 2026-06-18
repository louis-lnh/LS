package com.shd.lifesteal.impl.discord;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.api.GameplayRoleSnapshot;
import com.shd.lifesteal.impl.config.LifestealConfig;
import com.shd.lifesteal.impl.dragon.DragonEggGlowHandler;
import com.shd.lifesteal.impl.heart.HeartService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.MinecraftServer;

public final class DiscordRoleSyncService {
    private static final int SYNC_SCHEMA_VERSION = 2;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private final LifestealConfig config;
    private final HeartService heartService;
    private final DragonEggGlowHandler dragonEggGlowHandler;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(REQUEST_TIMEOUT)
            .build();
    private Instant nextSync = Instant.EPOCH;
    private CompletableFuture<?> pendingSync = CompletableFuture.completedFuture(null);

    public DiscordRoleSyncService(LifestealConfig config, HeartService heartService, DragonEggGlowHandler dragonEggGlowHandler) {
        this.config = config;
        this.heartService = heartService;
        this.dragonEggGlowHandler = dragonEggGlowHandler;
    }

    public void register() {
        if (!config.discordRoleSyncEnabled()) {
            ShdLifestealMod.LOGGER.info("Discord gameplay role sync is disabled");
            return;
        }

        ServerTickEvents.END_SERVER_TICK.register(this::tick);
        ShdLifestealMod.LOGGER.info("Discord gameplay role sync enabled for {}", config.discordRoleSyncEndpoint());
    }

    private void tick(MinecraftServer server) {
        Instant now = Instant.now();
        if (now.isBefore(nextSync) || !pendingSync.isDone()) {
            return;
        }

        nextSync = now.plus(config.discordRoleSyncInterval());
        pendingSync = sync(server);
    }

    private CompletableFuture<Void> sync(MinecraftServer server) {
        List<GameplayRoleSnapshot> snapshots = heartService.gameplayRoles(server);
        HttpRequest request = HttpRequest.newBuilder(URI.create(config.discordRoleSyncEndpoint()))
                .header("Authorization", "Bearer " + config.discordApiSharedSecret())
                .header("Content-Type", "application/json")
                .timeout(REQUEST_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.ofString(toJson(server, snapshots)))
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(response -> {
                    if (response.statusCode() < 200 || response.statusCode() >= 300) {
                        ShdLifestealMod.LOGGER.warn(
                                "Discord gameplay role sync to {} failed with HTTP {}: {}",
                                config.discordRoleSyncEndpoint(),
                                response.statusCode(),
                                compactBody(response.body())
                        );
                    }
                })
                .exceptionally(exception -> {
                    Throwable cause = rootCause(exception);
                    ShdLifestealMod.LOGGER.warn(
                            "Discord gameplay role sync to {} failed: {}: {}",
                            config.discordRoleSyncEndpoint(),
                            cause.getClass().getSimpleName(),
                            cause.getMessage()
                    );
                    return null;
                });
    }

    private static Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current;
    }

    private static String compactBody(String body) {
        if (body == null || body.isBlank()) {
            return "<empty response>";
        }
        return body.length() <= 500 ? body : body.substring(0, 500) + "...";
    }

    private String toJson(MinecraftServer server, List<GameplayRoleSnapshot> snapshots) {
        JsonObject root = new JsonObject();
        root.addProperty("schemaVersion", SYNC_SCHEMA_VERSION);
        root.addProperty("source", "shd-lifesteal");
        root.addProperty("sentAt", Instant.now().toString());

        JsonObject status = new JsonObject();
        status.addProperty("onlinePlayers", server.getCurrentPlayerCount());
        status.addProperty("maxPlayers", server.getMaxPlayerCount());

        GracePeriodSnapshot gracePeriod = heartService.gracePeriod();
        JsonObject grace = new JsonObject();
        grace.addProperty("active", gracePeriod.active());
        grace.addProperty("paused", gracePeriod.paused());
        grace.addProperty("remainingSeconds", gracePeriod.remaining().toSeconds());
        status.add("grace", grace);
        root.add("status", status);

        JsonArray players = new JsonArray();
        for (GameplayRoleSnapshot snapshot : snapshots) {
            JsonObject player = new JsonObject();
            player.addProperty("playerId", snapshot.playerId().toString());
            player.addProperty("minecraftUuid", snapshot.playerId().toString());
            player.addProperty("heartsCurrent", snapshot.hearts());
            player.addProperty("killsTotal", snapshot.kills());
            player.addProperty("deathsTotal", snapshot.deaths());
            player.addProperty("revivalsTotal", snapshot.revivals());
            player.addProperty("heartGains", snapshot.heartGains());
            player.addProperty("heartLosses", snapshot.heartLosses());
            player.addProperty("maceKills", snapshot.maceKills());
            player.addProperty("uniqueKills", snapshot.uniqueKills());
            player.addProperty("currentKillstreak", snapshot.currentKillstreak());
            player.addProperty("highestKillstreak", snapshot.highestKillstreak());
            player.addProperty("maceOneKills", snapshot.maceOneKills());
            player.addProperty("maceTwoKills", snapshot.maceTwoKills());
            player.addProperty("playtimeSeconds", snapshot.playtimeSeconds());
            player.addProperty("hearts", snapshot.hearts());
            player.addProperty("kills", snapshot.kills());
            player.addProperty("deaths", snapshot.deaths());
            player.addProperty("revivals", snapshot.revivals());
            player.addProperty("eliminated", snapshot.eliminated());
            player.addProperty("twentyHearts", snapshot.twentyHearts());
            player.addProperty("dragonEggHolder", snapshot.dragonEggHolder());
            player.addProperty("maceWielder", snapshot.maceWielder());
            player.addProperty("maceIdentity", snapshot.maceIdentity());
            dragonEggGlowHandler.glowExpiresAt(snapshot.playerId()).ifPresentOrElse(expiresAt -> {
                player.addProperty("dragonEggGlowExpiresAt", expiresAt.toString());
                player.addProperty("dragonEggGlowRemainingSeconds", Math.max(0L, Duration.between(Instant.now(), expiresAt).toSeconds()));
            }, () -> {
                player.addProperty("dragonEggGlowExpiresAt", "");
                player.addProperty("dragonEggGlowRemainingSeconds", 0L);
            });
            players.add(player);
        }
        root.add("players", players);
        return root.toString();
    }
}
