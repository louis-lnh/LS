package com.shd.lifesteal.impl.anticheat;

import java.time.Instant;

public record AntiCheatReview(
        String evidenceId,
        AntiCheatCaseStatus status,
        String staffName,
        Instant reviewedAt,
        String note
) {
    public AntiCheatReview {
        status = status == null ? AntiCheatCaseStatus.OPEN : status;
        staffName = staffName == null ? "" : staffName;
        note = note == null ? "" : note.replace('\n', ' ').replace('\r', ' ').trim();
    }

    public static AntiCheatReview open(String evidenceId) {
        return new AntiCheatReview(evidenceId, AntiCheatCaseStatus.OPEN, "", null, "");
    }

    public String summary() {
        String staff = staffName.isBlank() ? "" : " by=" + staffName;
        String at = reviewedAt == null ? "" : " at=" + reviewedAt;
        String noteText = note.isBlank() ? "" : " note=\"" + note + "\"";
        return "case=%s%s%s%s".formatted(status, staff, at, noteText);
    }
}
