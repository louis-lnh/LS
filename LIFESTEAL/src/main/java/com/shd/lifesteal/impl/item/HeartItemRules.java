package com.shd.lifesteal.impl.item;

import com.shd.lifesteal.impl.storage.RestrictedItemKind;
import com.shd.lifesteal.impl.storage.RestrictedItemLocation;
import com.shd.lifesteal.impl.storage.RestrictedItemPolicy;

public final class HeartItemRules {
    private final RestrictedItemPolicy restrictedItemPolicy;

    public HeartItemRules(RestrictedItemPolicy restrictedItemPolicy) {
        this.restrictedItemPolicy = restrictedItemPolicy;
    }

    public boolean canPlaceInLocation(RestrictedItemLocation location) {
        return restrictedItemPolicy.allowed(RestrictedItemKind.HEART, location);
    }
}
