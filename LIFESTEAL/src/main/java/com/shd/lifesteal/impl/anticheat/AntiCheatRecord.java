package com.shd.lifesteal.impl.anticheat;

import java.time.Instant;

public record AntiCheatRecord(
        AntiCheatEvidence evidence,
        AntiCheatCategory category,
        AntiCheatSeverity severity,
        AntiCheatAction action,
        String reasonCode,
        String publicReason,
        String appealId,
        Instant expiresAt
) {
    public String compactSummary() {
        String appeal = appealId == null || appealId.isBlank() ? "" : " appealId=" + appealId;
        String expires = expiresAt == null ? "" : " expiresAt=" + expiresAt;
        return "%s %s/%s action=%s player=%s reason=%s evidenceId=%s%s%s".formatted(
                evidence.timestamp(),
                category,
                severity,
                action,
                evidence.playerName(),
                reasonCode,
                evidence.evidenceId(),
                appeal,
                expires
        );
    }

    public String detailedSummary() {
        String appeal = appealId == null || appealId.isBlank() ? "none" : appealId;
        String expires = expiresAt == null ? "none" : expiresAt.toString();
        return "%s action=%s category=%s severity=%s player=%s uuid=%s reason=%s publicReason=\"%s\" evidenceId=%s appealId=%s expiresAt=%s context=\"%s\"".formatted(
                evidence.timestamp(),
                action,
                category,
                severity,
                evidence.playerName(),
                evidence.playerId(),
                reasonCode,
                publicReason,
                evidence.evidenceId(),
                appeal,
                expires,
                evidence.context()
        );
    }
}
