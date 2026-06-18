package com.shd.lifesteal.impl.anticheat;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonParseException;
import com.shd.lifesteal.ShdLifestealMod;
import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.minecraft.server.network.ServerPlayerEntity;

public final class AntiCheatIdentityStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final String IP_HASH_PREFIX = "shd-anticheat-ip-v1|";
    private static final int MAX_STORED_VALUES = 20;

    private final Path path;
    private final Map<UUID, StoredIdentity> identities = new HashMap<>();

    public AntiCheatIdentityStore(Path path) {
        this.path = path;
    }

    public synchronized void load() {
        identities.clear();
        if (!Files.exists(path)) {
            return;
        }

        try (Reader reader = Files.newBufferedReader(path)) {
            StoredIdentity[] entries = GSON.fromJson(reader, StoredIdentity[].class);
            if (entries == null) {
                return;
            }
            for (StoredIdentity entry : entries) {
                if (entry.valid()) {
                    entry.normalize();
                    identities.put(UUID.fromString(entry.uuid), entry);
                }
            }
        } catch (IOException | IllegalArgumentException | JsonParseException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to load anti-cheat identity store", exception);
        }
    }

    public synchronized LoginAssessment recordLogin(ServerPlayerEntity player, boolean staffOperator) {
        UUID playerId = player.getUuid();
        String playerName = player.getName().getString();
        String normalizedName = normalize(playerName);
        String ipHash = hashIp(player.getIp());
        Instant now = Instant.now();

        StoredIdentity identity = identities.computeIfAbsent(playerId, ignored -> StoredIdentity.create(playerId, now));
        String previousName = identity.lastName == null ? "" : identity.lastName;
        boolean nameChanged = !previousName.isBlank() && !previousName.equalsIgnoreCase(playerName);
        Set<UUID> nameUsers = uuidsForName(normalizedName);
        nameUsers.remove(playerId);

        identity.lastName = playerName;
        identity.lastSeen = now.toString();
        identity.lastIpHash = ipHash;
        identity.staffOperatorSeen = identity.staffOperatorSeen || staffOperator;
        addUnique(identity.names, normalizedName);
        addUnique(identity.ipHashes, ipHash);

        Set<UUID> ipUsers = uuidsForIpHash(ipHash);
        ipUsers.add(playerId);
        save();

        return new LoginAssessment(
                previousName,
                nameChanged,
                nameUsers,
                ipHash,
                ipUsers,
                staffOperator
        );
    }

    public synchronized BrandAssessment recordBrand(ServerPlayerEntity player, String brand) {
        UUID playerId = player.getUuid();
        String normalizedBrand = normalize(brand);
        Instant now = Instant.now();
        StoredIdentity identity = identities.computeIfAbsent(playerId, ignored -> StoredIdentity.create(playerId, now));
        String previousBrand = identity.lastClientBrand == null ? "" : identity.lastClientBrand;
        boolean changed = !previousBrand.isBlank() && !previousBrand.equalsIgnoreCase(normalizedBrand);

        identity.lastName = player.getName().getString();
        identity.lastSeen = now.toString();
        identity.lastClientBrand = normalizedBrand;
        addUnique(identity.clientBrands, normalizedBrand);
        save();

        return new BrandAssessment(previousBrand, normalizedBrand, changed);
    }

    private Set<UUID> uuidsForName(String normalizedName) {
        Set<UUID> matches = new LinkedHashSet<>();
        for (Map.Entry<UUID, StoredIdentity> entry : identities.entrySet()) {
            if (entry.getValue().names.contains(normalizedName)) {
                matches.add(entry.getKey());
            }
        }
        return matches;
    }

    private Set<UUID> uuidsForIpHash(String ipHash) {
        Set<UUID> matches = new LinkedHashSet<>();
        for (Map.Entry<UUID, StoredIdentity> entry : identities.entrySet()) {
            if (entry.getValue().ipHashes.contains(ipHash)) {
                matches.add(entry.getKey());
            }
        }
        return matches;
    }

    private void save() {
        try {
            Files.createDirectories(path.getParent());
            List<StoredIdentity> entries = new ArrayList<>(identities.values());
            entries.sort(Comparator.comparing(entry -> entry.lastName == null ? "" : entry.lastName, String.CASE_INSENSITIVE_ORDER));
            Files.writeString(path, GSON.toJson(entries));
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to save anti-cheat identity store", exception);
        }
    }

    private static void addUnique(List<String> values, String value) {
        if (value == null || value.isBlank() || values.contains(value)) {
            return;
        }
        values.add(value);
        while (values.size() > MAX_STORED_VALUES) {
            values.remove(0);
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String hashIp(String ip) {
        String normalized = ip == null ? "unknown" : ip.trim().toLowerCase(Locale.ROOT);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((IP_HASH_PREFIX + normalized).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < Math.min(8, hash.length); i++) {
                builder.append("%02x".formatted(hash[i] & 0xFF));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            return Integer.toHexString(normalized.hashCode());
        }
    }

    public record LoginAssessment(
            String previousName,
            boolean nameChanged,
            Set<UUID> otherUuidsForName,
            String ipHash,
            Set<UUID> uuidsForIpHash,
            boolean staffOperator
    ) {
    }

    public record BrandAssessment(
            String previousBrand,
            String currentBrand,
            boolean changed
    ) {
    }

    private static final class StoredIdentity {
        String uuid;
        String firstSeen;
        String lastSeen;
        String lastName;
        List<String> names = new ArrayList<>();
        String lastIpHash;
        List<String> ipHashes = new ArrayList<>();
        String lastClientBrand;
        List<String> clientBrands = new ArrayList<>();
        boolean staffOperatorSeen;

        static StoredIdentity create(UUID playerId, Instant now) {
            StoredIdentity identity = new StoredIdentity();
            identity.uuid = playerId.toString();
            identity.firstSeen = now.toString();
            identity.lastSeen = now.toString();
            return identity;
        }

        boolean valid() {
            return uuid != null && !uuid.isBlank();
        }

        void normalize() {
            if (names == null) {
                names = new ArrayList<>();
            }
            if (ipHashes == null) {
                ipHashes = new ArrayList<>();
            }
            if (clientBrands == null) {
                clientBrands = new ArrayList<>();
            }
            names = normalizedList(names);
            ipHashes = normalizedList(ipHashes);
            clientBrands = normalizedList(clientBrands);
        }

        private List<String> normalizedList(List<String> values) {
            List<String> normalized = new ArrayList<>();
            for (String value : values) {
                String entry = AntiCheatIdentityStore.normalize(value);
                if (!entry.isBlank() && !normalized.contains(entry)) {
                    normalized.add(entry);
                }
            }
            while (normalized.size() > MAX_STORED_VALUES) {
                normalized.remove(0);
            }
            return normalized;
        }
    }
}
