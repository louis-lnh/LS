package com.shd.lifesteal.impl.config;

import java.time.Duration;

public record LifestealConfig(
        int startingHearts,
        int maxHearts,
        int revivalHearts,
        Duration combatTagDuration,
        Duration gracePeriodDuration,
        String discordRoleSyncEndpoint,
        String discordIdentityEndpoint,
        String discordApiSharedSecret,
        Duration discordRoleSyncInterval,
        Duration dragonEggGlowDuration
) {
    public static LifestealConfig defaults() {
        return new LifestealConfig(
                10,
                20,
                3,
                Duration.ofSeconds(30),
                Duration.ofMinutes(60),
                env("LIFESTEAL_DISCORD_ROLE_SYNC_ENDPOINT", ""),
                env("LIFESTEAL_DISCORD_IDENTITY_ENDPOINT", ""),
                env("LIFESTEAL_DISCORD_API_SHARED_SECRET", ""),
                Duration.ofSeconds(envLong("LIFESTEAL_DISCORD_ROLE_SYNC_INTERVAL_SECONDS", 60)),
                Duration.ofHours(envLong("LIFESTEAL_DRAGON_EGG_GLOW_HOURS", 12))
        );
    }

    public boolean discordRoleSyncEnabled() {
        return !discordRoleSyncEndpoint.isBlank() && !discordApiSharedSecret.isBlank();
    }

    public boolean discordIdentityLookupEnabled() {
        return (!discordIdentityEndpoint.isBlank() || !discordRoleSyncEndpoint.isBlank()) && !discordApiSharedSecret.isBlank();
    }

    public String discordMinecraftIdentityEndpoint(String minecraftUuid) {
        if (!discordIdentityEndpoint.isBlank()) {
            return discordIdentityEndpoint.replace("{minecraftUuid}", minecraftUuid);
        }
        if (discordRoleSyncEndpoint.endsWith("/api/v1/gameplay/roles/sync")) {
            return discordRoleSyncEndpoint.substring(0, discordRoleSyncEndpoint.length() - "/api/v1/gameplay/roles/sync".length())
                    + "/api/v1/lifesteal/identity/minecraft/" + minecraftUuid;
        }
        return "";
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static long envLong(String name, long fallback) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            return fallback;
        }

        try {
            return Math.max(1, Long.parseLong(value));
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }
}
