package com.shd.lifesteal.impl.ui;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

public final class LifestealUiSettings {
    public static final String ACTIONBAR = "actionbar";
    public static final String TAB = "tab";
    public static final String SCOREBOARD = "scoreboard";
    public static final String BOSSBAR = "bossbar";
    public static final String SOUNDS = "sounds";

    private final Path path;
    private boolean actionbarEnabled = true;
    private boolean tabEnabled = true;
    private boolean scoreboardEnabled;
    private boolean bossbarEnabled;
    private boolean soundsEnabled = true;
    private String deathSound = "wither_spawn";
    private String eliminationSound = "wither_death";
    private String revivalSound = "beacon_activate";
    private String tabTitle = "SHD Lifesteal";
    private String tabSeason = "Beta Version";
    private String tabAd = "";
    private Set<String> owners = Set.of();
    private Set<String> admins = Set.of();
    private Set<String> shdTeam = Set.of();
    private Set<String> mods = Set.of();

    public LifestealUiSettings(Path path) {
        this.path = path;
    }

    public void load() {
        Properties properties = new Properties();
        if (Files.exists(path)) {
            try (InputStream input = Files.newInputStream(path)) {
                properties.load(input);
            } catch (IOException ignored) {
                return;
            }
        }

        actionbarEnabled = booleanProperty(properties, ACTIONBAR, actionbarEnabled);
        tabEnabled = booleanProperty(properties, TAB, tabEnabled);
        scoreboardEnabled = booleanProperty(properties, SCOREBOARD, scoreboardEnabled);
        bossbarEnabled = booleanProperty(properties, BOSSBAR, bossbarEnabled);
        soundsEnabled = booleanProperty(properties, SOUNDS, soundsEnabled);
        deathSound = properties.getProperty("deathSound", deathSound);
        eliminationSound = properties.getProperty("eliminationSound", eliminationSound);
        revivalSound = properties.getProperty("revivalSound", revivalSound);
        tabTitle = properties.getProperty("tabTitle", tabTitle);
        tabSeason = properties.getProperty("tabSeason", tabSeason);
        if ("Season 1".equalsIgnoreCase(tabSeason.trim())) {
            tabSeason = "Beta Version";
        }
        tabAd = properties.getProperty("tabAd", tabAd);
        owners = names(properties.getProperty("owners", ""));
        admins = names(properties.getProperty("admins", ""));
        shdTeam = names(properties.getProperty("shdTeam", ""));
        mods = names(properties.getProperty("mods", ""));
        save();
    }

    public boolean enabled(String feature) {
        return switch (normal(feature)) {
            case ACTIONBAR -> actionbarEnabled;
            case TAB -> tabEnabled;
            case SCOREBOARD -> scoreboardEnabled;
            case BOSSBAR -> bossbarEnabled;
            case SOUNDS -> soundsEnabled;
            default -> false;
        };
    }

    public boolean setEnabled(String feature, boolean enabled) {
        switch (normal(feature)) {
            case ACTIONBAR -> actionbarEnabled = enabled;
            case TAB -> tabEnabled = enabled;
            case SCOREBOARD -> scoreboardEnabled = enabled;
            case BOSSBAR -> bossbarEnabled = enabled;
            case SOUNDS -> soundsEnabled = enabled;
            default -> {
                return false;
            }
        }
        save();
        return true;
    }

    public String featuresText() {
        return "actionbar=%s, tab=%s, scoreboard=%s, bossbar=%s, sounds=%s, deathSound=%s, eliminationSound=%s, revivalSound=%s".formatted(
                actionbarEnabled,
                tabEnabled,
                scoreboardEnabled,
                bossbarEnabled,
                soundsEnabled,
                deathSound,
                eliminationSound,
                revivalSound
        );
    }

    public String sound(String type) {
        return switch (normal(type)) {
            case "death" -> deathSound;
            case "elimination" -> eliminationSound;
            case "revival" -> revivalSound;
            default -> "";
        };
    }

    public boolean setSound(String type, String sound) {
        switch (normal(type)) {
            case "death" -> deathSound = sound;
            case "elimination" -> eliminationSound = sound;
            case "revival" -> revivalSound = sound;
            default -> {
                return false;
            }
        }
        save();
        return true;
    }

    public String tabTitle() {
        return tabTitle;
    }

    public String tabSeason() {
        return tabSeason;
    }

    public String tabAd() {
        return tabAd;
    }

    public String staffRole(String playerName) {
        String normalized = normal(playerName);
        if (owners.contains(normalized)) {
            return "Owner";
        }
        if (admins.contains(normalized)) {
            return "Admin";
        }
        if (mods.contains(normalized)) {
            return "Mod";
        }
        if (shdTeam.contains(normalized)) {
            return "SHD Team";
        }
        return "";
    }

    public boolean setPrefixRole(String role, String playerName, boolean enabled) {
        Set<String> current = roleSet(role);
        if (current == null) {
            return false;
        }

        Set<String> updated = new HashSet<>(current);
        String normalized = normal(playerName);
        if (normalized.isBlank()) {
            return false;
        }
        if (enabled) {
            owners = without(owners, normalized);
            admins = without(admins, normalized);
            mods = without(mods, normalized);
            shdTeam = without(shdTeam, normalized);
            updated.add(normalized);
        } else {
            updated.remove(normalized);
        }
        assignRoleSet(role, Set.copyOf(updated));
        save();
        return true;
    }

    public String prefixRolesText() {
        return "owners=%s, admins=%s, mods=%s, shdTeam=%s".formatted(
                String.join(",", owners),
                String.join(",", admins),
                String.join(",", mods),
                String.join(",", shdTeam)
        );
    }

    private void save() {
        Properties properties = new Properties();
        properties.setProperty(ACTIONBAR, Boolean.toString(actionbarEnabled));
        properties.setProperty(TAB, Boolean.toString(tabEnabled));
        properties.setProperty(SCOREBOARD, Boolean.toString(scoreboardEnabled));
        properties.setProperty(BOSSBAR, Boolean.toString(bossbarEnabled));
        properties.setProperty(SOUNDS, Boolean.toString(soundsEnabled));
        properties.setProperty("deathSound", deathSound);
        properties.setProperty("eliminationSound", eliminationSound);
        properties.setProperty("revivalSound", revivalSound);
        properties.setProperty("tabTitle", tabTitle);
        properties.setProperty("tabSeason", tabSeason);
        properties.setProperty("tabAd", tabAd);
        properties.setProperty("owners", String.join(",", owners));
        properties.setProperty("admins", String.join(",", admins));
        properties.setProperty("shdTeam", String.join(",", shdTeam));
        properties.setProperty("mods", String.join(",", mods));

        try {
            Files.createDirectories(path.getParent());
            try (OutputStream output = Files.newOutputStream(path)) {
                properties.store(output, "SHD Lifesteal UI settings");
            }
        } catch (IOException ignored) {
            // UI settings should never prevent the server from starting.
        }
    }

    private static boolean booleanProperty(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        return value == null || value.isBlank() ? fallback : Boolean.parseBoolean(value);
    }

    private static Set<String> names(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(value.split(","))
                .map(LifestealUiSettings::normal)
                .filter(name -> !name.isBlank())
                .collect(Collectors.toUnmodifiableSet());
    }

    private static Set<String> without(Set<String> values, String removed) {
        if (!values.contains(removed)) {
            return values;
        }

        Set<String> updated = new HashSet<>(values);
        updated.remove(removed);
        return Set.copyOf(updated);
    }

    private static String normal(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private Set<String> roleSet(String role) {
        return switch (normalRole(role)) {
            case "owner" -> owners;
            case "admin" -> admins;
            case "mod" -> mods;
            case "shd_team" -> shdTeam;
            default -> null;
        };
    }

    private void assignRoleSet(String role, Set<String> values) {
        switch (normalRole(role)) {
            case "owner" -> owners = values;
            case "admin" -> admins = values;
            case "mod" -> mods = values;
            case "shd_team" -> shdTeam = values;
            default -> {
            }
        }
    }

    private static String normalRole(String value) {
        return normal(value).replace("-", "_");
    }
}
