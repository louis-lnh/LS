package com.shd.lifesteal.impl.ui;

import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.api.GameplayRoleSnapshot;
import com.shd.lifesteal.api.PlayerHeartState;
import com.shd.lifesteal.api.ui.DragonEggUiState;
import com.shd.lifesteal.api.ui.LifestealUiBridge;
import com.shd.lifesteal.api.ui.LifestealUiAlert;
import com.shd.lifesteal.api.ui.LifestealUiEvent;
import com.shd.lifesteal.api.ui.PlayerUiNotice;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import net.fabricmc.loader.api.FabricLoader;

public final class UiBridgeManager implements LifestealUiBridge {
    public static final String ENTRYPOINT = "shd-lifesteal-ui";

    private final List<LifestealUiBridge> bridges = new CopyOnWriteArrayList<>();

    public void loadEntrypoints() {
        FabricLoader.getInstance()
                .getEntrypointContainers(ENTRYPOINT, LifestealUiBridge.class)
                .forEach(container -> {
                    bridges.add(container.getEntrypoint());
                    ShdLifestealMod.LOGGER.info(
                            "Loaded lifesteal UI bridge from {}",
                            container.getProvider().getMetadata().getId()
                    );
                });
    }

    @Override
    public boolean isFeatureEnabled(String featureKey) {
        return bridges.stream().allMatch(bridge -> bridge.isFeatureEnabled(featureKey));
    }

    @Override
    public void onGracePeriodChanged(GracePeriodSnapshot snapshot) {
        bridges.forEach(bridge -> bridge.onGracePeriodChanged(snapshot));
    }

    @Override
    public void onPlayerHeartStateChanged(PlayerHeartState state) {
        bridges.forEach(bridge -> bridge.onPlayerHeartStateChanged(state));
    }

    @Override
    public void onGameplayRoleChanged(GameplayRoleSnapshot snapshot) {
        bridges.forEach(bridge -> bridge.onGameplayRoleChanged(snapshot));
    }

    @Override
    public void onCombatTagChanged(UUID playerId, boolean tagged, int remainingSeconds) {
        bridges.forEach(bridge -> bridge.onCombatTagChanged(playerId, tagged, remainingSeconds));
    }

    @Override
    public void onDragonEggStateChanged(DragonEggUiState state) {
        bridges.forEach(bridge -> bridge.onDragonEggStateChanged(state));
    }

    @Override
    public void onGameplayEvent(LifestealUiEvent event) {
        bridges.forEach(bridge -> bridge.onGameplayEvent(event));
    }

    @Override
    public void onStaffAlert(LifestealUiAlert alert) {
        bridges.forEach(bridge -> bridge.onStaffAlert(alert));
    }

    @Override
    public void onPlayerNotice(PlayerUiNotice notice) {
        bridges.forEach(bridge -> bridge.onPlayerNotice(notice));
    }
}
