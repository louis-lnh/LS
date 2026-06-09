package com.shd.lifesteal.impl.restriction;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.shd.lifesteal.ShdLifestealMod;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.BundleContentsComponent;
import net.minecraft.component.type.NbtComponent;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.decoration.ItemFrameEntity;
import net.minecraft.inventory.Inventory;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.TypeFilter;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.chunk.WorldChunk;

public final class MaceLimitRules {
    public static final int MAX_MACES = 2;
    private static final int PLAYER_CHUNK_SCAN_RADIUS = 2;
    private static final long BACKGROUND_SCAN_INTERVAL_TICKS = 600L;
    private static final String MACE_ID_KEY = "shd_lifesteal_mace_id";
    private static final String EVENT_KIT_MACE_KEY = "shd_lifesteal_event_kit_mace";
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private static final State STATE = new State();
    private static Path registryPath;
    private static Path auditLogPath;
    private static boolean initialized;
    private static long ticks;

    private MaceLimitRules() {
    }

    public static void initialize(Path configDirectory) {
        if (initialized) {
            return;
        }

        registryPath = configDirectory.resolve("maces.json");
        auditLogPath = configDirectory.resolve("mace-audit.log");
        load();
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            ticks++;
            if (ticks % BACKGROUND_SCAN_INTERVAL_TICKS == 0L) {
                scanServer(server);
            }
        });
        initialized = true;
    }

    public static boolean blocksNewMace(ItemStack output, MinecraftServer server) {
        if (!output.isOf(Items.MACE) || isEventKitMace(output)) {
            return false;
        }

        scanServer(server);
        boolean blocked = activeMaceCount() >= MAX_MACES;
        if (blocked) {
            audit("Blocked mace craft because " + activeMaceCount() + " tracked maces already exist.");
        }
        return blocked;
    }

    public static CraftedMaceResult markCraftedMace(ItemStack stack, MinecraftServer server, String location) {
        return markCraftedMace(stack, server, location, null);
    }

    public static CraftedMaceResult markCraftedMace(ItemStack stack, MinecraftServer server, String location, ServerPlayerEntity owner) {
        if (!stack.isOf(Items.MACE) || isEventKitMace(stack)) {
            return new CraftedMaceResult(false, activeMaceCount());
        }

        scanServer(server);
        boolean created = maceId(stack).isEmpty();
        ensureTagged(stack, location, true, server, owner);
        save();
        return new CraftedMaceResult(created, activeMaceCount());
    }

    public static int countKnownMaces(MinecraftServer server) {
        scanServer(server);
        return activeMaceCount();
    }

    public static void retireMace(ItemStack stack, String reason) {
        if (!stack.isOf(Items.MACE) || isEventKitMace(stack)) {
            return;
        }

        Optional<String> id = maceId(stack);
        if (id.isEmpty()) {
            return;
        }

        if (STATE.maces.remove(id.get()) != null) {
            audit("Retired mace " + id.get() + ": " + reason + ". Active tracked maces: " + activeMaceCount());
            save();
        }
    }

    private static void scanServer(MinecraftServer server) {
        boolean changed = false;
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            changed |= scanInventory(player.getInventory(), "player " + player.getName().getString() + " inventory", server, player);
            for (EquipmentSlot slot : EquipmentSlot.VALUES) {
                ItemStack equippedStack = player.getEquippedStack(slot);
                if (isExtraUntaggedMace(equippedStack)) {
                    audit("Removed untracked extra mace from player " + player.getName().getString() + " " + slot.getName() + " because the mace limit is already full.");
                    player.equipStack(slot, ItemStack.EMPTY);
                    changed = true;
                    continue;
                }
                changed |= scanStack(equippedStack, "player " + player.getName().getString() + " " + slot.getName(), server, player);
            }
        }

        for (ServerWorld world : server.getWorlds()) {
            changed |= scanLoadedMaceEntities(world);
            changed |= scanLoadedStorageNearPlayers(world);
        }

        if (changed) {
            save();
        }
    }

    private static boolean scanLoadedMaceEntities(ServerWorld world) {
        boolean changed = false;
        for (ItemEntity itemEntity : world.getEntitiesByType(TypeFilter.instanceOf(ItemEntity.class), entity -> true)) {
            if (isExtraUntaggedMace(itemEntity.getStack())) {
                audit("Removed untracked extra dropped mace at " + world.getRegistryKey().getValue() + " " + itemEntity.getBlockPos().toShortString() + " because the mace limit is already full.");
                itemEntity.discard();
                changed = true;
                continue;
            }
            changed |= scanStack(itemEntity.getStack(), "dropped item " + world.getRegistryKey().getValue() + " " + itemEntity.getBlockPos().toShortString(), world.getServer(), null);
        }
        for (ItemFrameEntity itemFrame : world.getEntitiesByType(TypeFilter.instanceOf(ItemFrameEntity.class), entity -> true)) {
            if (isExtraUntaggedMace(itemFrame.getHeldItemStack())) {
                audit("Removed untracked extra framed mace at " + world.getRegistryKey().getValue() + " " + itemFrame.getBlockPos().toShortString() + " because the mace limit is already full.");
                itemFrame.setHeldItemStack(ItemStack.EMPTY);
                changed = true;
                continue;
            }
            changed |= scanStack(itemFrame.getHeldItemStack(), "item frame " + world.getRegistryKey().getValue() + " " + itemFrame.getBlockPos().toShortString(), world.getServer(), null);
        }
        return changed;
    }

    private static boolean scanLoadedStorageNearPlayers(ServerWorld world) {
        boolean changed = false;
        Set<ChunkPos> checkedChunks = new HashSet<>();
        for (ServerPlayerEntity player : world.getPlayers()) {
            ChunkPos playerChunk = player.getChunkPos();
            for (int chunkX = playerChunk.x - PLAYER_CHUNK_SCAN_RADIUS; chunkX <= playerChunk.x + PLAYER_CHUNK_SCAN_RADIUS; chunkX++) {
                for (int chunkZ = playerChunk.z - PLAYER_CHUNK_SCAN_RADIUS; chunkZ <= playerChunk.z + PLAYER_CHUNK_SCAN_RADIUS; chunkZ++) {
                    ChunkPos chunkPos = new ChunkPos(chunkX, chunkZ);
                    if (!checkedChunks.add(chunkPos) || !world.getChunkManager().isChunkLoaded(chunkX, chunkZ)) {
                        continue;
                    }

                    WorldChunk chunk = world.getChunkManager().getWorldChunk(chunkX, chunkZ);
                    if (chunk == null) {
                        continue;
                    }

                    for (BlockEntity blockEntity : chunk.getBlockEntities().values()) {
                        if (blockEntity instanceof Inventory inventory) {
                            changed |= scanInventory(inventory, "storage " + world.getRegistryKey().getValue() + " " + blockEntity.getPos().toShortString(), world.getServer(), null);
                        }
                    }
                }
            }
        }
        return changed;
    }

    private static boolean scanInventory(Inventory inventory, String location, MinecraftServer server, ServerPlayerEntity owner) {
        boolean changed = false;
        for (int slot = 0; slot < inventory.size(); slot++) {
            ItemStack stack = inventory.getStack(slot);
            if (stack.isEmpty()) {
                continue;
            }

            if (isExtraUntaggedMace(stack)) {
                audit("Removed untracked extra mace from " + location + " slot " + slot + " because the mace limit is already full.");
                inventory.setStack(slot, ItemStack.EMPTY);
                inventory.markDirty();
                changed = true;
                continue;
            }

            ItemStack scanned = scanStackAndBundle(stack, location + " slot " + slot, server, owner);
            if (scanned != stack) {
                inventory.setStack(slot, scanned);
                inventory.markDirty();
                changed = true;
            } else if (scanned.isOf(Items.MACE)) {
                changed |= ensureTagged(scanned, location + " slot " + slot, false, server, owner);
            }
        }
        return changed;
    }

    private static boolean scanStack(ItemStack stack, String location, MinecraftServer server, ServerPlayerEntity owner) {
        if (stack.isEmpty()) {
            return false;
        }

        if (stack.isOf(Items.MACE) && !isEventKitMace(stack)) {
            return ensureTagged(stack, location, false, server, owner);
        }

        return false;
    }

    private static ItemStack scanStackAndBundle(ItemStack stack, String location, MinecraftServer server, ServerPlayerEntity owner) {
        if (stack.isOf(Items.MACE) && !isEventKitMace(stack)) {
            ensureTagged(stack, location, false, server, owner);
            return stack;
        }

        BundleContentsComponent contents = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
        if (contents == null || contents.isEmpty()) {
            return stack;
        }

        BundleContentsComponent.Builder builder = new BundleContentsComponent.Builder(BundleContentsComponent.DEFAULT);
        boolean changed = false;
        int index = 0;
        for (ItemStack bundledStack : contents.iterateCopy()) {
            ItemStack copy = bundledStack.copy();
            if (isExtraUntaggedMace(copy)) {
                audit("Removed untracked extra mace from " + location + " bundle item " + index + " because the mace limit is already full.");
                changed = true;
                index++;
                continue;
            }
            if (copy.isOf(Items.MACE) && !isEventKitMace(copy) && ensureTagged(copy, location + " bundle item " + index, false, server, owner)) {
                changed = true;
            }
            builder.add(copy);
            index++;
        }

        if (!changed) {
            return stack;
        }

        ItemStack updated = stack.copy();
        updated.set(DataComponentTypes.BUNDLE_CONTENTS, builder.build());
        return updated;
    }

    private static boolean isExtraUntaggedMace(ItemStack stack) {
        return stack.isOf(Items.MACE) && !isEventKitMace(stack) && maceId(stack).isEmpty() && activeMaceCount() >= MAX_MACES;
    }

    private static boolean ensureTagged(ItemStack stack, String location, boolean craftedNow, MinecraftServer server, ServerPlayerEntity owner) {
        Optional<String> existingId = maceId(stack);
        if (existingId.isPresent()) {
            return updateRecord(existingId.get(), location, server, owner);
        }

        String id = UUID.randomUUID().toString();
        NbtComponent.set(DataComponentTypes.CUSTOM_DATA, stack, nbt -> nbt.putString(MACE_ID_KEY, id));
        STATE.maces.put(id, new MaceRecord(
                location,
                Instant.now().toString(),
                owner == null ? "" : owner.getUuidAsString(),
                owner == null ? "" : owner.getName().getString()
        ));

        String reason = craftedNow ? "Issued crafted mace" : "Discovered untagged mace and issued tracking id";
        audit(reason + " " + id + " at " + location + ". Active tracked maces: " + activeMaceCount());
        if (activeMaceCount() > MAX_MACES) {
            audit("MACE LIMIT VIOLATION: " + activeMaceCount() + " tracked maces exist after " + id + " appeared at " + location + ".");
        }
        return true;
    }

    private static Optional<String> maceId(ItemStack stack) {
        NbtComponent customData = stack.get(DataComponentTypes.CUSTOM_DATA);
        if (customData == null) {
            return Optional.empty();
        }

        NbtCompound nbt = customData.copyNbt();
        return nbt.getString(MACE_ID_KEY).filter(value -> !value.isBlank());
    }

    private static boolean isEventKitMace(ItemStack stack) {
        NbtComponent customData = stack.get(DataComponentTypes.CUSTOM_DATA);
        if (customData == null) {
            return false;
        }

        return customData.copyNbt().getBoolean(EVENT_KIT_MACE_KEY).orElse(false);
    }

    private static boolean updateRecord(String id, String location, MinecraftServer server, ServerPlayerEntity owner) {
        MaceRecord current = STATE.maces.get(id);
        if (current == null) {
            return false;
        }

        String currentOwnerId = current.ownerId == null ? "" : current.ownerId;
        String currentOwnerName = current.ownerName == null ? "" : current.ownerName;
        String ownerId = owner == null ? currentOwnerId : owner.getUuidAsString();
        String ownerName = owner == null ? currentOwnerName : owner.getName().getString();
        boolean ownerChanged = owner != null && !currentOwnerId.isBlank() && !owner.getUuidAsString().equals(currentOwnerId);
        if (current.location.equals(location) && !ownerChanged) {
            return false;
        }

        STATE.maces.put(id, new MaceRecord(location, Instant.now().toString(), ownerId, ownerName));
        if (ownerChanged) {
            announceMaceAcquired(server, owner, activeMaceCount());
        }
        return true;
    }

    private static void announceMaceAcquired(MinecraftServer server, ServerPlayerEntity player, int activeCount) {
        if (server == null || player == null) {
            return;
        }

        String playerName = player.getName().getString();
        String message = activeCount >= MAX_MACES
                ? playerName + " acquired the second Mace. Maces are no longer craftable!"
                : playerName + " acquired one Mace. " + Math.max(1, activeCount) + "/" + MAX_MACES + " crafted.";
        server.getPlayerManager()
                .getPlayerList()
                .forEach(onlinePlayer -> onlinePlayer.sendMessage(net.minecraft.text.Text.literal(message).formatted(net.minecraft.util.Formatting.GOLD), false));
    }

    public static Optional<String> lastSeenAt(String maceId) {
        MaceRecord record = STATE.maces.get(maceId);
        return record == null ? Optional.empty() : Optional.of(record.lastSeenAt);
    }

    private static int activeMaceCount() {
        return STATE.maces.size();
    }

    private static void load() {
        if (registryPath == null || !Files.exists(registryPath)) {
            return;
        }

        try (Reader reader = Files.newBufferedReader(registryPath)) {
            State loaded = GSON.fromJson(reader, State.class);
            if (loaded != null && loaded.maces != null) {
                STATE.maces.clear();
                STATE.maces.putAll(loaded.maces);
            }
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to load mace registry", exception);
        }
    }

    private static void save() {
        if (registryPath == null) {
            return;
        }

        try {
            Files.createDirectories(registryPath.getParent());
            Files.writeString(registryPath, GSON.toJson(STATE));
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to save mace registry", exception);
        }
    }

    private static void audit(String message) {
        ShdLifestealMod.LOGGER.warn("[MaceLimit] {}", message);
        if (auditLogPath == null) {
            return;
        }

        try {
            Files.createDirectories(auditLogPath.getParent());
            Files.writeString(
                    auditLogPath,
                    Instant.now() + " " + message + System.lineSeparator(),
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND
            );
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to write mace audit log", exception);
        }
    }

    private static final class State {
        private Map<String, MaceRecord> maces = new LinkedHashMap<>();
    }

    private static final class MaceRecord {
        private String location;
        private String lastSeenAt;
        private String ownerId = "";
        private String ownerName = "";

        private MaceRecord(String location, String lastSeenAt, String ownerId, String ownerName) {
            this.location = location;
            this.lastSeenAt = lastSeenAt;
            this.ownerId = ownerId;
            this.ownerName = ownerName;
        }
    }

    public record CraftedMaceResult(boolean created, int activeCount) {
    }
}
