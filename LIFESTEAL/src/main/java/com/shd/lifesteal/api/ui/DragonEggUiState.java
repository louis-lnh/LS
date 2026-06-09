package com.shd.lifesteal.api.ui;

public record DragonEggUiState(
        DragonEggLocationKind kind,
        String world,
        int x,
        int y,
        int z,
        boolean exact
) {
    public static DragonEggUiState absent() {
        return new DragonEggUiState(DragonEggLocationKind.ABSENT, "", 0, 0, 0, false);
    }
}
