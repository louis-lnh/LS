package com.shd.lifesteal.impl.audit;

import com.shd.lifesteal.ShdLifestealMod;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;

public final class LifestealAuditLog {
    private final Path path;

    public LifestealAuditLog(Path path) {
        this.path = path;
    }

    public void log(String category, String message) {
        String line = "%s [%s] %s%n".formatted(Instant.now(), category, message);
        ShdLifestealMod.LOGGER.info("[Audit:{}] {}", category, message);
        try {
            Files.createDirectories(path.getParent());
            Files.writeString(path, line, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to write Lifesteal audit log", exception);
        }
    }
}
