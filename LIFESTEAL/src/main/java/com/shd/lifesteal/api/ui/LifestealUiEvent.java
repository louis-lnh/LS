package com.shd.lifesteal.api.ui;

import java.util.UUID;

public record LifestealUiEvent(
        String type,
        String message,
        UUID primaryPlayer,
        UUID secondaryPlayer
) {
}
