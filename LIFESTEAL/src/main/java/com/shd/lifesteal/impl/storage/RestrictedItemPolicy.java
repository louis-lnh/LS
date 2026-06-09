package com.shd.lifesteal.impl.storage;

public final class RestrictedItemPolicy {
    public boolean allowed(RestrictedItemKind itemKind, RestrictedItemLocation location) {
        return switch (location) {
            case PLAYER_INVENTORY, WORLD_DROP, ITEM_FRAME -> true;
            case PLACED_BLOCK -> itemKind == RestrictedItemKind.DRAGON_EGG;
            case BLOCK_INVENTORY, BUNDLE -> false;
        };
    }
}
