package com.shd.lifesteal.impl.storage;

import com.shd.lifesteal.impl.item.ModItems;
import java.util.HashSet;
import java.util.Set;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.block.entity.CrafterBlockEntity;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.BundleContentsComponent;
import net.minecraft.entity.ItemEntity;
import net.minecraft.inventory.Inventory;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.chunk.WorldChunk;

public final class RestrictedStorageHandler {
    private static final int PLAYER_CHUNK_SCAN_RADIUS = 2;
    private static final long STORAGE_SCAN_INTERVAL_TICKS = 600L;
    private static final Set<Item> CRAFTER_RESTRICTED_ITEMS = Set.of(
            Items.BREEZE_ROD,
            Items.HEAVY_CORE,
            Items.DRAGON_HEAD,
            Items.WITHER_SKELETON_SKULL,
            Items.NETHERITE_INGOT,
            Items.NAUTILUS_SHELL,
            Items.BEACON
    );

    private final ModItems modItems;
    private long ticks;

    public RestrictedStorageHandler(ModItems modItems) {
        this.modItems = modItems;
    }

    public void register() {
        ServerTickEvents.END_SERVER_TICK.register(this::sanitizeStorage);
    }

    private void sanitizeStorage(MinecraftServer server) {
        ticks++;
        if (ticks % STORAGE_SCAN_INTERVAL_TICKS != 0L) {
            return;
        }

        for (ServerWorld world : server.getWorlds()) {
            sanitizeLoadedStorageNearPlayers(world);
        }
    }

    private void sanitizeLoadedStorageNearPlayers(ServerWorld world) {
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
                            sanitizeInventory(world, blockEntity.getPos(), inventory, blockEntity instanceof CrafterBlockEntity);
                        }
                    }
                }
            }
        }
    }

    private void sanitizeInventory(ServerWorld world, BlockPos pos, Inventory inventory, boolean strictCrafter) {
        boolean changed = false;
        for (int slot = 0; slot < inventory.size(); slot++) {
            ItemStack stack = inventory.getStack(slot);
            if (stack.isEmpty()) {
                continue;
            }

            if (isRestrictedItem(stack, strictCrafter)) {
                inventory.setStack(slot, ItemStack.EMPTY);
                eject(world, pos, stack);
                changed = true;
                continue;
            }

            ItemStack cleanedBundle = removeRestrictedBundleContents(world, pos, stack, strictCrafter);
            if (cleanedBundle != stack) {
                inventory.setStack(slot, cleanedBundle);
                changed = true;
            }
        }

        if (changed) {
            inventory.markDirty();
        }
    }

    private ItemStack removeRestrictedBundleContents(ServerWorld world, BlockPos pos, ItemStack stack, boolean strictCrafter) {
        BundleContentsComponent contents = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
        if (contents == null || contents.isEmpty()) {
            return stack;
        }

        BundleContentsComponent.Builder builder = new BundleContentsComponent.Builder(BundleContentsComponent.DEFAULT);
        boolean changed = false;
        for (ItemStack bundledStack : contents.iterateCopy()) {
            if (isRestrictedItem(bundledStack, strictCrafter)) {
                eject(world, pos, bundledStack.copy());
                changed = true;
                continue;
            }
            builder.add(bundledStack.copy());
        }

        if (!changed) {
            return stack;
        }

        ItemStack cleaned = stack.copy();
        cleaned.set(DataComponentTypes.BUNDLE_CONTENTS, builder.build());
        return cleaned;
    }

    private boolean isRestrictedItem(ItemStack stack, boolean strictCrafter) {
        return stack.isOf(modItems.heart())
                || stack.isOf(Items.DRAGON_EGG)
                || (strictCrafter && CRAFTER_RESTRICTED_ITEMS.stream().anyMatch(stack::isOf));
    }

    private void eject(ServerWorld world, BlockPos pos, ItemStack stack) {
        double x = pos.getX() + 0.5D;
        double y = pos.getY() + 1.0D;
        double z = pos.getZ() + 0.5D;
        ItemEntity itemEntity = new ItemEntity(world, x, y, z, stack);
        itemEntity.setVelocity(0.0D, 0.1D, 0.0D);
        world.spawnEntity(itemEntity);
    }
}
