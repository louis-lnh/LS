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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.BundleContentsComponent;
import net.minecraft.component.type.NbtComponent;
import net.minecraft.enchantment.Enchantment;
import net.minecraft.enchantment.Enchantments;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.decoration.ItemFrameEntity;
import net.minecraft.inventory.Inventory;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.registry.DynamicRegistryManager;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.registry.RegistryEntryLookup;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.TypeFilter;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.chunk.WorldChunk;

public final class MaceLimitRules {
    public static final int MAX_ACTIVE_MACES = 2;
    public static final String MACE_ONE = "M1";
    public static final String MACE_TWO = "M2";
    private static final int EVENT_MACE_MAX_DAMAGE = 250;
    private static final int PLAYER_CHUNK_SCAN_RADIUS = 2;
    private static final long BACKGROUND_SCAN_INTERVAL_TICKS = 600L;
    private static final String CUSTOM_MACE_KEY = "shd_lifesteal_custom_mace";
    private static final String CUSTOM_MACE_ID_KEY = "shd_lifesteal_custom_mace_id";
    private static final String CUSTOM_MACE_TRACKABLE_KEY = "shd_lifesteal_custom_mace_trackable";
    private static final String CUSTOM_MACE_INSTANCE_KEY = "shd_lifesteal_custom_mace_instance";
    private static final String LEGACY_EVENT_KIT_MACE_KEY = "shd_lifesteal_event_kit_mace";
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final List<MaceSpec> SPECS = List.of(
            new MaceSpec(MACE_ONE, "SHD Mace M1", 1),
            new MaceSpec(MACE_TWO, "SHD Mace M2", 2)
    );

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

    public static List<String> maceKeys() {
        return SPECS.stream().map(MaceSpec::key).toList();
    }

    public static Optional<String> normalizeMaceKey(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace("-", "").replace("_", "");
        return SPECS.stream()
                .map(MaceSpec::key)
                .filter(key -> key.equals(normalized))
                .findFirst();
    }

    public static ItemStack createEventMace(
            DynamicRegistryManager registryManager,
            String key,
            boolean trackable,
            String location,
            ServerPlayerEntity owner
    ) {
        MaceSpec spec = spec(key).orElseThrow(() -> new IllegalArgumentException("Unknown mace: " + key));
        String instanceId = UUID.randomUUID().toString();
        ItemStack stack = new ItemStack(Items.MACE);
        stack.set(DataComponentTypes.CUSTOM_NAME, Text.literal(spec.displayName()).formatted(Formatting.GOLD, Formatting.BOLD));
        stack.set(DataComponentTypes.MAX_DAMAGE, EVENT_MACE_MAX_DAMAGE);
        stack.set(DataComponentTypes.DAMAGE, 0);
        stack.addEnchantment(enchantment(registryManager, Enchantments.DENSITY), 5);
        stack.addEnchantment(enchantment(registryManager, Enchantments.WIND_BURST), spec.windBurstLevel());
        NbtComponent.set(DataComponentTypes.CUSTOM_DATA, stack, nbt -> {
            nbt.putBoolean(CUSTOM_MACE_KEY, true);
            nbt.putString(CUSTOM_MACE_ID_KEY, spec.key());
            nbt.putString(CUSTOM_MACE_INSTANCE_KEY, instanceId);
            nbt.putBoolean(CUSTOM_MACE_TRACKABLE_KEY, trackable);
        });

        if (trackable) {
            retireActiveMacesForKey(spec.key(), "replaced by newly issued " + instanceId);
            STATE.activeMaces.put(instanceId, new MaceRecord(
                    spec.key(),
                    location,
                    Instant.now().toString(),
                    owner == null ? "" : owner.getUuidAsString(),
                    owner == null ? "" : owner.getName().getString()
            ));
            audit("Issued tracked custom mace " + spec.key() + " (" + instanceId + ") at " + location + ".");
            save();
        } else {
            audit("Issued untracked custom mace " + spec.key() + " (" + instanceId + ") at " + location + ".");
        }

        return stack;
    }

    public static boolean blocksNewMace(ItemStack output, MinecraftServer server) {
        if (!output.isOf(Items.MACE)) {
            return false;
        }
        if (isCustomMace(output)) {
            return false;
        }

        audit("Blocked normal mace crafting/output. Maces are event-only custom items.");
        return true;
    }

    public static CraftedMaceResult markCraftedMace(ItemStack stack, MinecraftServer server, String location) {
        return markCraftedMace(stack, server, location, null);
    }

    public static CraftedMaceResult markCraftedMace(ItemStack stack, MinecraftServer server, String location, ServerPlayerEntity owner) {
        if (!stack.isOf(Items.MACE)) {
            return new CraftedMaceResult(false, activeMaceCount());
        }
        if (isCustomMace(stack)) {
            return new CraftedMaceResult(false, activeMaceCount());
        }

        audit("Removed crafted or invalid normal mace from " + location + ".");
        stack.setCount(0);
        return new CraftedMaceResult(false, activeMaceCount());
    }

    public static int countKnownMaces(MinecraftServer server) {
        scanServer(server);
        return activeMaceCount();
    }

    public static void retireMace(ItemStack stack, String reason) {
        Optional<String> instanceId = instanceId(stack);
        if (instanceId.isEmpty()) {
            return;
        }

        if (STATE.activeMaces.remove(instanceId.get()) != null) {
            audit("Retired custom mace " + instanceId.get() + ": " + reason + ". Active tracked maces: " + activeMaceCount());
            save();
        }
    }

    public static boolean isCustomMace(ItemStack stack) {
        return stack.isOf(Items.MACE) && customMaceKey(stack).isPresent();
    }

    public static boolean isInvalidMace(ItemStack stack) {
        return stack.isOf(Items.MACE) && !isCustomMace(stack);
    }

    public static Optional<String> heldTrackedMaceKey(ServerPlayerEntity player) {
        return carriedTrackedMaceKey(player);
    }

    public static Optional<String> carriedTrackedMaceKey(ServerPlayerEntity player) {
        for (int slot = 0; slot < player.getInventory().size(); slot++) {
            Optional<String> key = trackedMaceKey(player.getInventory().getStack(slot));
            if (key.isPresent()) {
                return key;
            }
        }

        return trackedMaceKey(player.currentScreenHandler.getCursorStack());
    }

    public static Optional<String> trackedMaceKey(ItemStack stack) {
        if (stack.isOf(Items.MACE)) {
            Optional<String> instanceId = instanceId(stack);
            if (instanceId.isEmpty() || !isTrackable(stack)) {
                return Optional.empty();
            }

            MaceRecord record = STATE.activeMaces.get(instanceId.get());
            if (record == null) {
                return Optional.empty();
            }

            return normalizeMaceKey(record.maceKey);
        }

        BundleContentsComponent contents = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
        if (contents == null || contents.isEmpty()) {
            return Optional.empty();
        }

        for (ItemStack bundledStack : contents.iterateCopy()) {
            Optional<String> key = trackedMaceKey(bundledStack);
            if (key.isPresent()) {
                return key;
            }
        }
        return Optional.empty();
    }

    public static Optional<String> maceIdentity(ItemStack stack) {
        return customMaceKey(stack);
    }

    private static RegistryEntry<Enchantment> enchantment(DynamicRegistryManager registryManager, net.minecraft.registry.RegistryKey<Enchantment> key) {
        RegistryEntryLookup<Enchantment> enchantments = registryManager.getOrThrow(RegistryKeys.ENCHANTMENT);
        return enchantments.getOrThrow(key);
    }

    private static void scanServer(MinecraftServer server) {
        boolean changed = false;
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            changed |= scanInventory(player.getInventory(), "player " + player.getName().getString() + " inventory", server, player);
            for (EquipmentSlot slot : EquipmentSlot.VALUES) {
                ItemStack equippedStack = player.getEquippedStack(slot);
                if (isInvalidMace(equippedStack)) {
                    audit("Removed invalid mace from player " + player.getName().getString() + " " + slot.getName() + ".");
                    player.equipStack(slot, ItemStack.EMPTY);
                    changed = true;
                    continue;
                }
                changed |= updateCustomMaceRecord(equippedStack, "player " + player.getName().getString() + " " + slot.getName(), player);
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
            if (isInvalidMace(itemEntity.getStack())) {
                audit("Removed invalid dropped mace at " + world.getRegistryKey().getValue() + " " + itemEntity.getBlockPos().toShortString() + ".");
                itemEntity.discard();
                changed = true;
                continue;
            }
            changed |= updateCustomMaceRecord(itemEntity.getStack(), "dropped item " + world.getRegistryKey().getValue() + " " + itemEntity.getBlockPos().toShortString(), null);
        }
        for (ItemFrameEntity itemFrame : world.getEntitiesByType(TypeFilter.instanceOf(ItemFrameEntity.class), entity -> true)) {
            if (isInvalidMace(itemFrame.getHeldItemStack())) {
                audit("Removed invalid framed mace at " + world.getRegistryKey().getValue() + " " + itemFrame.getBlockPos().toShortString() + ".");
                itemFrame.setHeldItemStack(ItemStack.EMPTY);
                changed = true;
                continue;
            }
            changed |= updateCustomMaceRecord(itemFrame.getHeldItemStack(), "item frame " + world.getRegistryKey().getValue() + " " + itemFrame.getBlockPos().toShortString(), null);
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

            ItemStack scanned = scanStackAndBundle(stack, location + " slot " + slot, owner);
            if (scanned != stack) {
                inventory.setStack(slot, scanned);
                inventory.markDirty();
                changed = true;
            } else if (scanned.isOf(Items.MACE)) {
                changed |= updateCustomMaceRecord(scanned, location + " slot " + slot, owner);
            }
        }
        return changed;
    }

    private static ItemStack scanStackAndBundle(ItemStack stack, String location, ServerPlayerEntity owner) {
        if (isInvalidMace(stack)) {
            audit("Removed invalid mace from " + location + ".");
            return ItemStack.EMPTY;
        }

        if (stack.isOf(Items.MACE)) {
            updateCustomMaceRecord(stack, location, owner);
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
            ItemStack scanned = scanStackAndBundle(copy, location + " bundle item " + index, owner);
            if (!scanned.isEmpty()) {
                builder.add(scanned);
            }
            if (scanned != copy) {
                changed = true;
            }
            index++;
        }

        if (!changed) {
            return stack;
        }

        ItemStack updated = stack.copy();
        updated.set(DataComponentTypes.BUNDLE_CONTENTS, builder.build());
        return updated;
    }

    private static boolean updateCustomMaceRecord(ItemStack stack, String location, ServerPlayerEntity owner) {
        if (!isCustomMace(stack) || !isTrackable(stack)) {
            return false;
        }

        Optional<String> instanceId = instanceId(stack);
        Optional<String> maceKey = customMaceKey(stack);
        if (instanceId.isEmpty() || maceKey.isEmpty()) {
            stripTrackable(stack);
            return true;
        }

        Optional<String> activeForKey = activeMaceIdForKey(maceKey.get());
        if (activeForKey.isPresent() && !activeForKey.get().equals(instanceId.get())) {
            stripTrackable(stack);
            audit("Converted duplicate tracked " + maceKey.get() + " " + instanceId.get() + " at " + location + " to untracked staff mace.");
            return true;
        }

        MaceRecord current = STATE.activeMaces.get(instanceId.get());
        String ownerId = owner == null ? current == null ? "" : current.ownerId : owner.getUuidAsString();
        String ownerName = owner == null ? current == null ? "" : current.ownerName : owner.getName().getString();
        if (current != null && current.location.equals(location) && ownerId.equals(current.ownerId) && ownerName.equals(current.ownerName)) {
            return false;
        }

        STATE.activeMaces.put(instanceId.get(), new MaceRecord(maceKey.get(), location, Instant.now().toString(), ownerId, ownerName));
        return true;
    }

    private static void stripTrackable(ItemStack stack) {
        NbtComponent.set(DataComponentTypes.CUSTOM_DATA, stack, nbt -> nbt.putBoolean(CUSTOM_MACE_TRACKABLE_KEY, false));
    }

    private static Optional<String> customMaceKey(ItemStack stack) {
        NbtComponent customData = stack.get(DataComponentTypes.CUSTOM_DATA);
        if (customData == null) {
            return Optional.empty();
        }

        NbtCompound nbt = customData.copyNbt();
        boolean custom = nbt.getBoolean(CUSTOM_MACE_KEY).orElse(false);
        if (!custom) {
            if (nbt.getBoolean(LEGACY_EVENT_KIT_MACE_KEY).orElse(false)) {
                return Optional.empty();
            }
            return Optional.empty();
        }
        return nbt.getString(CUSTOM_MACE_ID_KEY).flatMap(MaceLimitRules::normalizeMaceKey);
    }

    private static Optional<String> instanceId(ItemStack stack) {
        NbtComponent customData = stack.get(DataComponentTypes.CUSTOM_DATA);
        if (customData == null) {
            return Optional.empty();
        }

        return customData.copyNbt().getString(CUSTOM_MACE_INSTANCE_KEY).filter(value -> !value.isBlank());
    }

    private static boolean isTrackable(ItemStack stack) {
        NbtComponent customData = stack.get(DataComponentTypes.CUSTOM_DATA);
        if (customData == null) {
            return false;
        }

        return customData.copyNbt().getBoolean(CUSTOM_MACE_TRACKABLE_KEY).orElse(false);
    }

    private static Optional<MaceSpec> spec(String key) {
        return normalizeMaceKey(key).flatMap(normalized -> SPECS.stream()
                .filter(spec -> spec.key().equals(normalized))
                .findFirst());
    }

    private static Optional<String> activeMaceIdForKey(String key) {
        String normalized = normalizeMaceKey(key).orElse("");
        return STATE.activeMaces.entrySet().stream()
                .filter(entry -> normalizeMaceKey(entry.getValue().maceKey).orElse("").equals(normalized))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    private static void retireActiveMacesForKey(String key, String reason) {
        String normalized = normalizeMaceKey(key).orElse("");
        List<String> oldIds = STATE.activeMaces.entrySet().stream()
                .filter(entry -> normalizeMaceKey(entry.getValue().maceKey).orElse("").equals(normalized))
                .map(Map.Entry::getKey)
                .toList();
        for (String oldId : oldIds) {
            STATE.activeMaces.remove(oldId);
            audit("Retired previous " + normalized + " " + oldId + ": " + reason + ".");
        }
    }

    private static int activeMaceCount() {
        return STATE.activeMaces.size();
    }

    private static void load() {
        if (registryPath == null || !Files.exists(registryPath)) {
            return;
        }

        try (Reader reader = Files.newBufferedReader(registryPath)) {
            State loaded = GSON.fromJson(reader, State.class);
            if (loaded == null) {
                return;
            }
            if (loaded.activeMaces != null) {
                STATE.activeMaces.clear();
                STATE.activeMaces.putAll(loaded.activeMaces);
            } else if (loaded.maces != null) {
                STATE.activeMaces.clear();
                loaded.maces.forEach((id, record) -> {
                    String key = normalizeMaceKey(record.maceKey).orElse(MACE_ONE);
                    STATE.activeMaces.put(id, new MaceRecord(key, record.location, record.lastSeenAt, record.ownerId, record.ownerName));
                });
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

    private record MaceSpec(String key, String displayName, int windBurstLevel) {
    }

    private static final class State {
        private Map<String, MaceRecord> activeMaces = new LinkedHashMap<>();
        private Map<String, MaceRecord> maces = new LinkedHashMap<>();
    }

    private static final class MaceRecord {
        private String maceKey = MACE_ONE;
        private String location = "";
        private String lastSeenAt = "";
        private String ownerId = "";
        private String ownerName = "";

        private MaceRecord(String maceKey, String location, String lastSeenAt, String ownerId, String ownerName) {
            this.maceKey = maceKey;
            this.location = location;
            this.lastSeenAt = lastSeenAt;
            this.ownerId = ownerId;
            this.ownerName = ownerName;
        }
    }

    public record CraftedMaceResult(boolean created, int activeCount) {
    }
}
