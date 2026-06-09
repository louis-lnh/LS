package com.shd.lifesteal.impl.item;

import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.heart.PlayerHeartApplier;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.Identifier;
import net.minecraft.util.Rarity;

public final class ModItems {
    public static final Identifier HEART_ID = Identifier.of(ShdLifestealMod.MOD_ID, "heart");
    public static final RegistryKey<Item> HEART_KEY = RegistryKey.of(Registries.ITEM.getKey(), HEART_ID);

    private final HeartService heartService;
    private final PlayerHeartApplier playerHeartApplier;
    private Item heart;

    public ModItems(HeartService heartService, PlayerHeartApplier playerHeartApplier) {
        this.heartService = heartService;
        this.playerHeartApplier = playerHeartApplier;
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
    }

    public Item heart() {
        if (heart == null) {
            throw new IllegalStateException("Heart item accessed before item registration");
        }
        return heart;
    }
}
