package com.shd.lifesteal.impl.anticheat;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.shd.lifesteal.ShdLifestealMod;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public final class AntiCheatPersistence {
    private static final Gson GSON = new Gson();

    private final Path historyPath;
    private final Path reviewPath;

    public AntiCheatPersistence(Path historyPath, Path reviewPath) {
        this.historyPath = historyPath;
        this.reviewPath = reviewPath;
    }

    public List<AntiCheatRecord> loadRecentRecords(int limit, Map<String, AntiCheatReview> reviews) {
        if (!Files.exists(historyPath)) {
            return List.of();
        }

        ArrayDeque<AntiCheatRecord> records = new ArrayDeque<>();
        try (BufferedReader reader = Files.newBufferedReader(historyPath)) {
            String line;
            while ((line = reader.readLine()) != null) {
                parseRecord(line, reviews).ifPresent(record -> {
                    records.addFirst(record);
                    while (records.size() > limit) {
                        records.removeLast();
                    }
                });
            }
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to load anti-cheat history", exception);
        }

        return new ArrayList<>(records);
    }

    public Map<String, AntiCheatReview> loadReviews() {
        if (!Files.exists(reviewPath)) {
            return Map.of();
        }

        Map<String, AntiCheatReview> reviews = new HashMap<>();
        try (BufferedReader reader = Files.newBufferedReader(reviewPath)) {
            String line;
            while ((line = reader.readLine()) != null) {
                parseReview(line).ifPresent(review -> reviews.put(review.evidenceId(), review));
            }
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to load anti-cheat reviews", exception);
        }
        return reviews;
    }

    public void appendRecord(AntiCheatRecord record) {
        appendLine(historyPath, recordToJson(record));
    }

    public void appendReview(AntiCheatReview review) {
        appendLine(reviewPath, reviewToJson(review));
    }

    private Optional<AntiCheatRecord> parseRecord(String line, Map<String, AntiCheatReview> reviews) {
        if (line == null || line.isBlank()) {
            return Optional.empty();
        }

        try (Reader reader = new java.io.StringReader(line)) {
            JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
            AntiCheatEvidence evidence = new AntiCheatEvidence(
                    string(root, "evidenceId"),
                    string(root, "playerName"),
                    UUID.fromString(string(root, "playerId")),
                    Instant.parse(string(root, "timestamp")),
                    string(root, "world"),
                    doubleValue(root, "x"),
                    doubleValue(root, "y"),
                    doubleValue(root, "z"),
                    string(root, "context")
            );
            AntiCheatRecord record = new AntiCheatRecord(
                    evidence,
                    AntiCheatCategory.valueOf(string(root, "category")),
                    AntiCheatSeverity.valueOf(string(root, "severity")),
                    AntiCheatAction.parse(string(root, "action"), AntiCheatAction.AUDIT_ONLY),
                    string(root, "reasonCode"),
                    string(root, "publicReason"),
                    string(root, "appealId"),
                    instantOrNull(root, "expiresAt")
            );
            AntiCheatReview review = reviews.get(evidence.evidenceId());
            return Optional.of(review == null ? record : record.withReview(review));
        } catch (RuntimeException | IOException exception) {
            ShdLifestealMod.LOGGER.warn("Skipping invalid anti-cheat history line", exception);
            return Optional.empty();
        }
    }

    private Optional<AntiCheatReview> parseReview(String line) {
        if (line == null || line.isBlank()) {
            return Optional.empty();
        }

        try (Reader reader = new java.io.StringReader(line)) {
            JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
            String evidenceId = string(root, "evidenceId");
            if (evidenceId.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(new AntiCheatReview(
                    evidenceId,
                    AntiCheatCaseStatus.parse(string(root, "status"), AntiCheatCaseStatus.OPEN),
                    string(root, "staffName"),
                    instantOrNull(root, "reviewedAt"),
                    string(root, "note")
            ));
        } catch (RuntimeException | IOException exception) {
            ShdLifestealMod.LOGGER.warn("Skipping invalid anti-cheat review line", exception);
            return Optional.empty();
        }
    }

    private String recordToJson(AntiCheatRecord record) {
        JsonObject root = new JsonObject();
        root.addProperty("evidenceId", record.evidence().evidenceId());
        root.addProperty("playerName", record.evidence().playerName());
        root.addProperty("playerId", record.evidence().playerId().toString());
        root.addProperty("timestamp", record.evidence().timestamp().toString());
        root.addProperty("world", record.evidence().world());
        root.addProperty("x", record.evidence().x());
        root.addProperty("y", record.evidence().y());
        root.addProperty("z", record.evidence().z());
        root.addProperty("context", record.evidence().context());
        root.addProperty("category", record.category().name());
        root.addProperty("severity", record.severity().name());
        root.addProperty("action", record.action().name());
        root.addProperty("reasonCode", record.reasonCode());
        root.addProperty("publicReason", record.publicReason());
        root.addProperty("appealId", record.appealId());
        root.addProperty("expiresAt", record.expiresAt() == null ? "" : record.expiresAt().toString());
        return GSON.toJson(root);
    }

    private String reviewToJson(AntiCheatReview review) {
        JsonObject root = new JsonObject();
        root.addProperty("evidenceId", review.evidenceId());
        root.addProperty("status", review.status().name());
        root.addProperty("staffName", review.staffName());
        root.addProperty("reviewedAt", review.reviewedAt() == null ? "" : review.reviewedAt().toString());
        root.addProperty("note", review.note());
        return GSON.toJson(root);
    }

    private void appendLine(Path path, String line) {
        try {
            Files.createDirectories(path.getParent());
            Files.writeString(path, line + System.lineSeparator(), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to persist anti-cheat state to " + path, exception);
        }
    }

    private static String string(JsonObject root, String key) {
        return root.has(key) && !root.get(key).isJsonNull() ? root.get(key).getAsString() : "";
    }

    private static double doubleValue(JsonObject root, String key) {
        return root.has(key) && !root.get(key).isJsonNull() ? root.get(key).getAsDouble() : 0.0D;
    }

    private static Instant instantOrNull(JsonObject root, String key) {
        String value = string(root, key);
        return value.isBlank() ? null : Instant.parse(value);
    }
}
