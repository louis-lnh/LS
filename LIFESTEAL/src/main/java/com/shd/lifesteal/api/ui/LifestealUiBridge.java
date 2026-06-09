package com.shd.lifesteal.api.ui;

import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.api.GameplayRoleSnapshot;
import com.shd.lifesteal.api.PlayerHeartState;
import java.util.UUID;

public interface LifestealUiBridge {
    default boolean isFeatureEnabled(String featureKey) {
        return true;
    }

    default void onGracePeriodChanged(GracePeriodSnapshot snapshot) {
    }

    default void onPlayerHeartStateChanged(PlayerHeartState state) {
    }

    default void onGameplayRoleChanged(GameplayRoleSnapshot snapshot) {
    }

    default void onCombatTagChanged(UUID playerId, boolean tagged, int remainingSeconds) {
    }

    default void onDragonEggStateChanged(DragonEggUiState state) {
    }

    default void onGameplayEvent(LifestealUiEvent event) {
    }

    default void onStaffAlert(LifestealUiAlert alert) {
    }

    default void onPlayerNotice(PlayerUiNotice notice) {
    }
}
