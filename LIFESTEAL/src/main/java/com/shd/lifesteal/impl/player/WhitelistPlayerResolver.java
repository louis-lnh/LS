package com.shd.lifesteal.impl.player;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import com.shd.lifesteal.ShdLifestealMod;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public final class WhitelistPlayerResolver {
    private static final Gson GSON = new Gson();

    public ResolvedPlayer resolve(MinecraftServer server, String name) throws PlayerResolveException {
        ServerPlayerEntity onlinePlayer = server.getPlayerManager().getPlayer(name);
        if (onlinePlayer != null) {
            return new ResolvedPlayer(onlinePlayer.getUuid(), onlinePlayer.getName().getString(), Optional.of(onlinePlayer));
        }

        return whitelistEntries(server).stream()
                .filter(entry -> entry.name().equalsIgnoreCase(name))
                .findFirst()
                .map(entry -> new ResolvedPlayer(entry.uuid(), entry.name(), Optional.<ServerPlayerEntity>empty()))
                .orElseThrow(() -> new PlayerResolveException("Player '%s' is not online or whitelisted".formatted(name)));
    }

    public List<String> suggestNames(MinecraftServer server) {
        List<String> names = new ArrayList<>();
        names.addAll(List.of(server.getPlayerManager().getPlayerNames()));
        whitelistEntries(server).stream()
                .map(WhitelistEntry::name)
                .filter(name -> names.stream().noneMatch(existing -> existing.equalsIgnoreCase(name)))
                .forEach(names::add);
        names.sort(String.CASE_INSENSITIVE_ORDER);
        return names;
    }

    private List<WhitelistEntry> whitelistEntries(MinecraftServer server) {
        Path whitelistPath = server.getRunDirectory().resolve("whitelist.json");
        if (!Files.exists(whitelistPath)) {
            return List.of();
        }

        try (Reader reader = Files.newBufferedReader(whitelistPath)) {
            WhitelistEntry[] entries = GSON.fromJson(reader, WhitelistEntry[].class);
            if (entries == null) {
                return List.of();
            }

            List<WhitelistEntry> validEntries = new ArrayList<>();
            for (WhitelistEntry entry : entries) {
                if (entry.valid()) {
                    validEntries.add(entry);
                }
            }
            validEntries.sort(Comparator.comparing(entry -> entry.name().toLowerCase(Locale.ROOT)));
            return validEntries;
        } catch (IOException | IllegalArgumentException | JsonParseException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to read whitelist.json for lifesteal player resolution", exception);
            return List.of();
        }
    }

    private record WhitelistEntry(UUID uuid, String name) {
        boolean valid() {
            return uuid != null && name != null && !name.isBlank();
        }
    }
}
