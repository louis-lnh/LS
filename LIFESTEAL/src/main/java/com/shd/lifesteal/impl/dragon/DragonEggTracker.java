package com.shd.lifesteal.impl.dragon;

import com.shd.lifesteal.impl.storage.RestrictedItemKind;
import com.shd.lifesteal.impl.storage.RestrictedItemLocation;
import com.shd.lifesteal.impl.storage.RestrictedItemPolicy;
import java.util.UUID;

public final class DragonEggTracker {
    private final RestrictedItemPolicy restrictedItemPolicy;

    public DragonEggTracker(RestrictedItemPolicy restrictedItemPolicy) {
        this.restrictedItemPolicy = restrictedItemPolicy;
    }

    public boolean canPlaceInLocation(RestrictedItemLocation location) {
        return restrictedItemPolicy.allowed(RestrictedItemKind.DRAGON_EGG, location);
    }

    public void updateGlowingForHolder(UUID playerId, boolean carryingDragonEgg) {
        // Later pass applies/removes the vanilla glowing status effect on the server player entity.
    }
}
