package com.shd.lifesteal.impl.anticheat.lifesteal;

import com.shd.lifesteal.impl.anticheat.AntiCheatCategory;
import com.shd.lifesteal.impl.anticheat.AntiCheatSeverity;
import java.util.List;

public final class LifestealAntiCheatModule {
    private static final List<LifestealAntiCheatCheckDefinition> PLANNED_CHECKS = List.of(
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_heart_state_integrity",
                    AntiCheatCategory.HEART_INTEGRITY,
                    AntiCheatSeverity.CRITICAL,
                    "heart count bounds, heart gain/loss causality, and heart item economy"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_elimination_integrity",
                    AntiCheatCategory.ELIMINATION,
                    AntiCheatSeverity.CRITICAL,
                    "eliminated-player access, active-play state, and reconnect handling"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_revival_integrity",
                    AntiCheatCategory.REVIVAL,
                    AntiCheatSeverity.HIGH,
                    "revival source validation, staff action audit, and post-revival heart state"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_custom_mace_integrity",
                    AntiCheatCategory.CUSTOM_MACE,
                    AntiCheatSeverity.CRITICAL,
                    "custom mace identity, duplicate active maces, and unauthorized mace variants"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_dragon_egg_integrity",
                    AntiCheatCategory.DRAGON_EGG,
                    AntiCheatSeverity.CRITICAL,
                    "dragon egg ownership, storage location, holder state, and objective consistency"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_grace_period_integrity",
                    AntiCheatCategory.GRACE_PERIOD,
                    AntiCheatSeverity.HIGH,
                    "grace-period PvP, heart loss, elimination, and combat-tag suppression"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_combat_tag_integrity",
                    AntiCheatCategory.COMBAT_TAG,
                    AntiCheatSeverity.HIGH,
                    "combat tag lifecycle, logout death resolution, and restricted mobility escape paths"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_restricted_item_integrity",
                    AntiCheatCategory.RESTRICTED_ITEM,
                    AntiCheatSeverity.HIGH,
                    "restricted Lifesteal item possession, use, crafting, storage, and cleanup evidence"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_event_state_consistency",
                    AntiCheatCategory.EVENT_STATE,
                    AntiCheatSeverity.HIGH,
                    "event phase, End access, reward windows, and rule-toggle consistency"
            ),
            new LifestealAntiCheatCheckDefinition(
                    "lifesteal_public_snapshot_consistency",
                    AntiCheatCategory.PUBLIC_DATA_EXPOSURE,
                    AntiCheatSeverity.CRITICAL,
                    "Discord/API/website snapshots compared with authoritative server state"
            )
    );

    public String id() {
        return "lifesteal_integrity";
    }

    public boolean active() {
        return true;
    }

    public List<LifestealAntiCheatCheckDefinition> plannedChecks() {
        return PLANNED_CHECKS;
    }
}
