package com.shd.lifesteal.impl.anticheat.lifesteal;

import com.shd.lifesteal.impl.anticheat.AntiCheatCategory;
import com.shd.lifesteal.impl.anticheat.AntiCheatSeverity;

public record LifestealAntiCheatCheckDefinition(
        String id,
        AntiCheatCategory category,
        AntiCheatSeverity defaultSeverity,
        String scope
) {
}
