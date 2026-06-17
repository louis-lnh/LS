package com.shd.lifesteal.impl.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

public final class LifestealRuleSettings {
    private static final String SPEAR_COMBAT_BAN = "spearCombatBan";

    private final Path path;
    private boolean spearCombatBan;

    public LifestealRuleSettings(Path path) {
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

        spearCombatBan = booleanProperty(properties, SPEAR_COMBAT_BAN, spearCombatBan);
        save();
    }

    public boolean spearCombatBan() {
        return spearCombatBan;
    }

    public void setSpearCombatBan(boolean enabled) {
        spearCombatBan = enabled;
        save();
    }

    public String statusText() {
        return "spearCombatBan=%s".formatted(spearCombatBan);
    }

    private void save() {
        Properties properties = new Properties();
        properties.setProperty(SPEAR_COMBAT_BAN, Boolean.toString(spearCombatBan));

        try {
            Files.createDirectories(path.getParent());
            try (OutputStream output = Files.newOutputStream(path)) {
                properties.store(output, "SHD Lifesteal rule settings");
            }
        } catch (IOException ignored) {
            // Rule settings should never prevent the server from starting.
        }
    }

    private static boolean booleanProperty(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        return value == null || value.isBlank() ? fallback : Boolean.parseBoolean(value);
    }
}
