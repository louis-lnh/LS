package com.shd.lifesteal.impl.anticheat;

import com.shd.lifesteal.impl.audit.LifestealAuditLog;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import net.minecraft.server.BannedPlayerEntry;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.PlayerConfigEntry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class AntiCheatService {
    private final AntiCheatSettings settings;
    private final LifestealAuditLog auditLog;
    private final AntiCheatPersistence persistence;
    private final Deque<AntiCheatRecord> history = new ArrayDeque<>();
    private final Map<String, AntiCheatReview> reviews = new HashMap<>();

    public AntiCheatService(AntiCheatSettings settings, LifestealAuditLog auditLog, AntiCheatPersistence persistence) {
        this.settings = settings;
        this.auditLog = auditLog;
        this.persistence = persistence;
    }

    public void load() {
        reviews.clear();
        reviews.putAll(persistence.loadReviews());
        history.clear();
        for (AntiCheatRecord record : persistence.loadRecentRecords(settings.maxHistoryEntries(), reviews)) {
            history.addLast(record);
        }
    }

    public AntiCheatEnforcement handle(MinecraftServer server, ServerPlayerEntity player, AntiCheatDetection detection) {
        String evidenceId = id("ev");
        AntiCheatEvidence evidence = AntiCheatEvidence.capture(player, evidenceId, detection.context());
        AntiCheatAction action = settings.enabled() ? settings.actionFor(detection) : AntiCheatAction.AUDIT_ONLY;
        String appealId = action.disconnectsPlayer() ? id("ap") : "";
        Instant expiresAt = action == AntiCheatAction.TEMP_BAN ? Instant.now().plus(settings.tempBanDuration()) : null;
        AntiCheatEnforcement enforcement = new AntiCheatEnforcement(
                action,
                appealId,
                evidenceId,
                detection.reasonCode(),
                detection.publicReason(),
                expiresAt
        );
        AntiCheatRecord record = new AntiCheatRecord(
                evidence,
                detection.category(),
                detection.severity(),
                action,
                detection.reasonCode(),
                detection.publicReason(),
                appealId,
                expiresAt
        );
        remember(record);
        persistence.appendRecord(record);

        auditLog.log("anticheat", "%s category=%s severity=%s action=%s reason=%s appealId=%s %s".formatted(
                settings.enabled() ? "detection" : "detection-disabled",
                detection.category(),
                detection.severity(),
                action,
                detection.reasonCode(),
                appealId.isBlank() ? "none" : appealId,
                evidence.summary()
        ));
        notifyOperators(server, player, detection, action, evidence);

        if (action == AntiCheatAction.TEMP_BAN || action == AntiCheatAction.PERMANENT_BAN) {
            banPlayer(server, player, enforcement);
        }

        if (action.disconnectsPlayer()) {
            player.networkHandler.disconnect(disconnectMessage(enforcement));
        }

        return enforcement;
    }

    private void notifyOperators(
            MinecraftServer server,
            ServerPlayerEntity player,
            AntiCheatDetection detection,
            AntiCheatAction action,
            AntiCheatEvidence evidence
    ) {
        if (!settings.opChatAlertsEnabled() || detection.severity().ordinal() < settings.opChatAlertsMinSeverity().ordinal()) {
            return;
        }

        Text message = Text.literal("[SHD AC] ").formatted(formatting(detection.severity()), Formatting.BOLD)
                .append(Text.literal("%s %s ".formatted(detection.severity(), detection.category())).formatted(formatting(detection.severity())))
                .append(Text.literal(player.getName().getString()).formatted(Formatting.WHITE))
                .append(Text.literal(" %s action=%s evidence=%s".formatted(detection.reasonCode(), action, evidence.evidenceId())).formatted(Formatting.GRAY));
        server.getPlayerManager()
                .getPlayerList()
                .stream()
                .filter(online -> server.getPlayerManager().isOperator(new PlayerConfigEntry(online.getGameProfile())))
                .forEach(online -> online.sendMessage(message, false));
    }

    public String statusText() {
        return settings.statusText() + " loadedAlerts=" + history.size() + " openCases=" + openRecords(settings.maxHistoryEntries()).size();
    }

    public void reload() {
        settings.load();
        load();
    }

    public void clearHistory() {
        history.clear();
    }

    public List<AntiCheatRecord> recentRecords(int limit) {
        List<AntiCheatRecord> records = new ArrayList<>();
        int remaining = Math.max(1, limit);
        for (AntiCheatRecord record : history) {
            records.add(record);
            remaining--;
            if (remaining <= 0) {
                break;
            }
        }
        return records;
    }

    public List<AntiCheatRecord> recentRecords(UUID playerId, int limit) {
        List<AntiCheatRecord> records = new ArrayList<>();
        int remaining = Math.max(1, limit);
        for (AntiCheatRecord record : history) {
            if (!record.evidence().playerId().equals(playerId)) {
                continue;
            }
            records.add(record);
            remaining--;
            if (remaining <= 0) {
                break;
            }
        }
        return records;
    }

    public List<AntiCheatRecord> openRecords(int limit) {
        List<AntiCheatRecord> records = new ArrayList<>();
        int remaining = Math.max(1, limit);
        for (AntiCheatRecord record : history) {
            if (!record.review().status().unresolved()) {
                continue;
            }
            records.add(record);
            remaining--;
            if (remaining <= 0) {
                break;
            }
        }
        return records;
    }

    public Optional<AntiCheatRecord> findRecord(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        String normalized = id.trim();
        return history.stream()
                .filter(record -> record.evidence().evidenceId().equalsIgnoreCase(normalized)
                        || (record.appealId() != null && record.appealId().equalsIgnoreCase(normalized)))
                .findFirst();
    }

    public Optional<AntiCheatRecord> updateCase(String id, AntiCheatCaseStatus status, String staffName, String note) {
        Optional<AntiCheatRecord> record = findRecord(id);
        if (record.isEmpty()) {
            return Optional.empty();
        }

        AntiCheatReview review = new AntiCheatReview(
                record.get().evidence().evidenceId(),
                status,
                staffName,
                Instant.now(),
                note
        );
        persistence.appendReview(review);
        reviews.put(review.evidenceId(), review);
        AntiCheatRecord updated = replaceReview(record.get(), review);
        auditLog.log("anticheat-review", "%s marked %s as %s note=\"%s\"".formatted(
                staffName,
                updated.evidence().evidenceId(),
                status,
                review.note()
        ));
        return Optional.of(updated);
    }

    public Optional<AntiCheatRecord> annotateCase(String id, String staffName, String note) {
        Optional<AntiCheatRecord> record = findRecord(id);
        if (record.isEmpty()) {
            return Optional.empty();
        }
        return updateCase(id, record.get().review().status(), staffName, note);
    }

    private void remember(AntiCheatRecord record) {
        history.addFirst(record);
        while (history.size() > settings.maxHistoryEntries()) {
            history.removeLast();
        }
    }

    private AntiCheatRecord replaceReview(AntiCheatRecord record, AntiCheatReview review) {
        AntiCheatRecord updated = record.withReview(review);
        ArrayList<AntiCheatRecord> records = new ArrayList<>(history.size());
        for (AntiCheatRecord candidate : history) {
            records.add(candidate.evidence().evidenceId().equals(record.evidence().evidenceId()) ? updated : candidate);
        }
        history.clear();
        history.addAll(records);
        return updated;
    }

    private void banPlayer(MinecraftServer server, ServerPlayerEntity player, AntiCheatEnforcement enforcement) {
        Date created = Date.from(Instant.now());
        Date expires = enforcement.expiresAt() == null ? null : Date.from(enforcement.expiresAt());
        PlayerConfigEntry entry = new PlayerConfigEntry(player.getUuid(), player.getName().getString());
        BannedPlayerEntry ban = new BannedPlayerEntry(
                entry,
                created,
                "SHD Anti-Cheat",
                expires,
                banReason(enforcement)
        );
        server.getPlayerManager().getUserBanList().add(ban);
    }

    private String banReason(AntiCheatEnforcement enforcement) {
        return "%s (Appeal ID: %s, Evidence ID: %s)".formatted(
                enforcement.publicReason(),
                enforcement.appealId(),
                enforcement.evidenceId()
        );
    }

    private Text disconnectMessage(AntiCheatEnforcement enforcement) {
        Text header = Text.literal(title(enforcement.action())).formatted(Formatting.RED, Formatting.BOLD);
        Text reason = Text.literal("\nReason: " + enforcement.publicReason()).formatted(Formatting.WHITE);
        Text appeal = Text.literal("\nAppeal ID: " + enforcement.appealId()).formatted(Formatting.YELLOW);
        Text appealUrl = Text.literal("\nAppeal: " + settings.appealUrl()).formatted(Formatting.GRAY);
        Text evidence = Text.literal("\nEvidence ID: " + enforcement.evidenceId()).formatted(Formatting.DARK_GRAY);
        Text expires = enforcement.expiresAt() == null
                ? Text.empty()
                : Text.literal("\nExpires: " + enforcement.expiresAt()).formatted(Formatting.GRAY);
        return header.copy().append(reason).append(expires).append(appeal).append(appealUrl).append(evidence);
    }

    private static String title(AntiCheatAction action) {
        return switch (action) {
            case KICK -> "Disconnected by SHD Anti-Cheat";
            case TEMP_BAN -> "Temporarily banned by SHD Anti-Cheat";
            case PERMANENT_BAN -> "Permanently banned by SHD Anti-Cheat";
            default -> "SHD Anti-Cheat";
        };
    }

    private static Formatting formatting(AntiCheatSeverity severity) {
        return switch (severity) {
            case INFO -> Formatting.GRAY;
            case WARNING -> Formatting.YELLOW;
            case HIGH -> Formatting.RED;
            case CRITICAL -> Formatting.DARK_RED;
        };
    }

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }
}
