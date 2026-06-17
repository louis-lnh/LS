package com.shd.lifesteal.client;

import net.fabricmc.api.ModInitializer;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.Identifier;
import net.minecraft.util.Rarity;

public final class ShdLifestealClientMod implements ModInitializer {
    public static final String LIFESTEAL_MOD_ID = "shd-lifesteal";
    public static final Identifier HEART_ID = Identifier.of(LIFESTEAL_MOD_ID, "heart");
    public static final RegistryKey<Item> HEART_KEY = RegistryKey.of(Registries.ITEM.getKey(), HEART_ID);

    @Override
    public void onInitialize() {
        if (Registries.ITEM.containsId(HEART_ID)) {
            return;
        }

        Registry.register(
                Registries.ITEM,
                HEART_ID,
                new Item(new Item.Settings()
                        .registryKey(HEART_KEY)
                        .maxCount(16)
                        .rarity(Rarity.RARE)
                        .fireproof())
        );
    }
}
