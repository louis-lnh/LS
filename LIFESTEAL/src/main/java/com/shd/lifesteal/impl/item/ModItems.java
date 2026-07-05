package com.shd.lifesteal.impl.item;

import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import com.shd.lifesteal.impl.revival.RevivalBeaconItem;
import com.shd.lifesteal.impl.revival.RevivalService;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.Identifier;
import net.minecraft.util.Rarity;

public final class ModItems {
    public static final Identifier HEART_ID = Identifier.of(ShdLifestealMod.MOD_ID, "heart");
    public static final RegistryKey<Item> HEART_KEY = RegistryKey.of(Registries.ITEM.getKey(), HEART_ID);
    public static final Identifier REVIVAL_BEACON_ID = Identifier.of(ShdLifestealMod.MOD_ID, "revival_beacon");
    public static final RegistryKey<Item> REVIVAL_BEACON_KEY = RegistryKey.of(Registries.ITEM.getKey(), REVIVAL_BEACON_ID);

    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;
    private final RevivalService revivalService;
    private Item heart;
    private Item revivalBeacon;

    public ModItems(HeartService heartService, PlayerHeartApplier playerHeartApplier, RevivalService revivalService) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
        this.revivalService = revivalService;
    }

    public void register() {
        heart = Registry.register(
                Registries.ITEM,
                HEART_ID,
                new HeartItem(
                        heartService,
                        playerHeartApplier,
                        new Item.Settings()
                                .registryKey(HEART_KEY)
                                .maxCount(16)
                                .rarity(Rarity.RARE)
                                .fireproof()
                )
        );
        revivalBeacon = Registry.register(
                Registries.ITEM,
                REVIVAL_BEACON_ID,
                new RevivalBeaconItem(
                        revivalService,
                        new Item.Settings()
                                .registryKey(REVIVAL_BEACON_KEY)
                                .maxCount(1)
                                .rarity(Rarity.EPIC)
                                .fireproof()
                )
        );
    }

    public Item heart() {
        if (heart == null) {
            throw new IllegalStateException("Heart item accessed before item registration");
        }
        return heart;
    }

    public Item revivalBeacon() {
        if (revivalBeacon == null) {
            throw new IllegalStateException("Revival beacon item accessed before item registration");
        }
        return revivalBeacon;
    }
}
