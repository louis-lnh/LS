package com.shd.lifesteal.client;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.ModContainer;
import net.minecraft.item.Item;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.Identifier;
import net.minecraft.util.Rarity;

public final class ShdLifestealClientMod implements ModInitializer {
    public static final String LIFESTEAL_MOD_ID = "shd-lifesteal";
    public static final Identifier HEART_ID = Identifier.of(LIFESTEAL_MOD_ID, "heart");
    public static final Identifier INTEGRITY_CHANNEL_ID = Identifier.of("shd-lifesteal-client", "integrity");
    public static final RegistryKey<Item> HEART_KEY = RegistryKey.of(Registries.ITEM.getKey(), HEART_ID);
    private static final int MOD_REPORT_RETRY_TICKS = 200;
    private static final int MOD_REPORT_RETRY_INTERVAL_TICKS = 20;
    private int modReportResendTicks;

    @Override
    public void onInitialize() {
        registerIntegrityChannel();
        registerHeartItem();
    }

    private void registerHeartItem() {
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

    private void registerIntegrityChannel() {
        PayloadTypeRegistry.playS2C().register(IntegrityPayload.ID, IntegrityPayload.CODEC);
        PayloadTypeRegistry.playC2S().register(ModReportPayload.ID, ModReportPayload.CODEC);
        ClientPlayNetworking.registerGlobalReceiver(IntegrityPayload.ID, (payload, context) -> {
            modReportResendTicks = MOD_REPORT_RETRY_TICKS;
        });
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            modReportResendTicks = MOD_REPORT_RETRY_TICKS;
        });
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> modReportResendTicks = 0);
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (modReportResendTicks <= 0) {
                return;
            }

            modReportResendTicks--;
            if (modReportResendTicks % MOD_REPORT_RETRY_INTERVAL_TICKS == 0 && ClientPlayNetworking.canSend(ModReportPayload.ID)) {
                ClientPlayNetworking.send(modReport());
                modReportResendTicks = 0;
            }
        });
    }

    private ModReportPayload modReport() {
        return new ModReportPayload(ModReportPayload.CURRENT_PROTOCOL, collectMods());
    }

    private java.util.List<ModReportPayload.ModEntry> collectMods() {
        return FabricLoader.getInstance().getAllMods().stream()
                .map(this::toModEntry)
                .sorted(java.util.Comparator.comparing(ModReportPayload.ModEntry::id))
                .toList();
    }

    private ModReportPayload.ModEntry toModEntry(ModContainer container) {
        var metadata = container.getMetadata();
        return new ModReportPayload.ModEntry(
                metadata.getId(),
                metadata.getName(),
                metadata.getVersion().getFriendlyString()
        );
    }

    public record IntegrityPayload() implements CustomPayload {
        public static final IntegrityPayload INSTANCE = new IntegrityPayload();
        public static final Id<IntegrityPayload> ID = new Id<>(INTEGRITY_CHANNEL_ID);
        public static final PacketCodec<RegistryByteBuf, IntegrityPayload> CODEC = PacketCodec.of((payload, buffer) -> {
        }, buffer -> INSTANCE);

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }
}
