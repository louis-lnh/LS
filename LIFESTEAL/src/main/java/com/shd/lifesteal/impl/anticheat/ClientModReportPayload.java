package com.shd.lifesteal.impl.anticheat;

import java.util.ArrayList;
import java.util.List;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

public record ClientModReportPayload(int protocolVersion, List<ModEntry> mods) implements CustomPayload {
    public static final Identifier CHANNEL_ID = Identifier.of("shd-lifesteal-client", "mod_report");
    public static final Id<ClientModReportPayload> ID = new Id<>(CHANNEL_ID);
    private static final int MAX_MODS = 256;
    private static final int MAX_ID_LENGTH = 96;
    private static final int MAX_NAME_LENGTH = 128;
    private static final int MAX_VERSION_LENGTH = 96;

    public static final PacketCodec<RegistryByteBuf, ClientModReportPayload> CODEC = PacketCodec.of((payload, buffer) -> {
        List<ModEntry> entries = payload.mods == null ? List.of() : payload.mods;
        buffer.writeVarInt(payload.protocolVersion);
        buffer.writeVarInt(Math.min(entries.size(), MAX_MODS));
        for (ModEntry entry : entries.stream().limit(MAX_MODS).toList()) {
            writeString(buffer, entry.id, MAX_ID_LENGTH);
            writeString(buffer, entry.name, MAX_NAME_LENGTH);
            writeString(buffer, entry.version, MAX_VERSION_LENGTH);
        }
    }, buffer -> {
        int protocolVersion = buffer.readVarInt();
        int count = Math.max(0, buffer.readVarInt());
        List<ModEntry> entries = new ArrayList<>(Math.min(count, MAX_MODS));
        for (int index = 0; index < count; index++) {
            ModEntry entry = new ModEntry(
                    readString(buffer, MAX_ID_LENGTH),
                    readString(buffer, MAX_NAME_LENGTH),
                    readString(buffer, MAX_VERSION_LENGTH)
            );
            if (index < MAX_MODS) {
                entries.add(entry);
            }
        }
        return new ClientModReportPayload(protocolVersion, List.copyOf(entries));
    });

    @Override
    public Id<? extends CustomPayload> getId() {
        return ID;
    }

    private static void writeString(RegistryByteBuf buffer, String value, int maxLength) {
        buffer.writeString(truncate(value, maxLength));
    }

    private static String readString(RegistryByteBuf buffer, int maxLength) {
        return truncate(buffer.readString(maxLength), maxLength);
    }

    private static String truncate(String value, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    public record ModEntry(String id, String name, String version) {
    }
}
