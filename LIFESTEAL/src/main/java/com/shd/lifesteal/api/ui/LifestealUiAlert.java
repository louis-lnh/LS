package com.shd.lifesteal.api.ui;

import java.util.UUID;

public record LifestealUiAlert(
        UiAlertSeverity severity,
        String title,
        String message,
        UUID actor,
        UUID target
) {
}
