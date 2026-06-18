package com.shd.lifesteal.impl.anticheat;

public interface AntiCheatCheck {
    String id();

    default void register() {
    }

    void tick(AntiCheatCheckContext context);

    default void endServerTick(AntiCheatServerTickContext context) {
    }
}
