package com.shd.lifesteal.impl.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

public final class LifestealRuleSettings {
    private final Path path;

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

        save();
    }

    public String statusText() {
        return "static season rules active";
    }

    private void save() {
        Properties properties = new Properties();

        try {
            Files.createDirectories(path.getParent());
            try (OutputStream output = Files.newOutputStream(path)) {
                properties.store(output, "SHD Lifesteal rule settings");
            }
        } catch (IOException ignored) {
            // Rule settings should never prevent the server from starting.
        }
    }

}
