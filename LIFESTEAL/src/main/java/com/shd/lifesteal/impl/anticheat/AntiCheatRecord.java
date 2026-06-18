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
        Instant expiresAt,
        AntiCheatReview review
) {
    public AntiCheatRecord(
            AntiCheatEvidence evidence,
            AntiCheatCategory category,
            AntiCheatSeverity severity,
            AntiCheatAction action,
            String reasonCode,
            String publicReason,
            String appealId,
            Instant expiresAt
    ) {
        this(evidence, category, severity, action, reasonCode, publicReason, appealId, expiresAt, AntiCheatReview.open(evidence.evidenceId()));
    }

    public AntiCheatRecord {
        review = review == null ? AntiCheatReview.open(evidence.evidenceId()) : review;
    }

    public AntiCheatRecord withReview(AntiCheatReview updatedReview) {
        return new AntiCheatRecord(
                evidence,
                category,
                severity,
                action,
                reasonCode,
                publicReason,
                appealId,
                expiresAt,
                updatedReview
        );
    }

    public String compactSummary() {
        String appeal = appealId == null || appealId.isBlank() ? "" : " appealId=" + appealId;
        String expires = expiresAt == null ? "" : " expiresAt=" + expiresAt;
        return "%s %s/%s action=%s case=%s player=%s reason=%s evidenceId=%s%s%s".formatted(
                evidence.timestamp(),
                category,
                severity,
                action,
                review.status(),
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
        return "%s action=%s category=%s severity=%s %s player=%s uuid=%s reason=%s publicReason=\"%s\" evidenceId=%s appealId=%s expiresAt=%s context=\"%s\"".formatted(
                evidence.timestamp(),
                action,
                category,
                severity,
                review.summary(),
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
