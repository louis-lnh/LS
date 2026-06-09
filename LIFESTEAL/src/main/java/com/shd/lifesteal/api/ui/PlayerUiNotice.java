package com.shd.lifesteal.api.ui;

import java.util.UUID;

public record PlayerUiNotice(
        UUID playerId,
        String type,
        String message
) {
}
