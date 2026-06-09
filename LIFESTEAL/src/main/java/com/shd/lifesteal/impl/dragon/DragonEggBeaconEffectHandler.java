package com.shd.lifesteal.impl.dragon;

import com.shd.lifesteal.api.ui.DragonEggLocationKind;
import com.shd.lifesteal.api.ui.DragonEggUiState;
import com.shd.lifesteal.ShdLifestealMod;
import com.shd.lifesteal.impl.objective.PlayerObjectiveInventoryScanner;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import java.util.Set;
import net.minecraft.block.Block;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.Blocks;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.decoration.ItemFrameEntity;
import net.minecraft.item.Items;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.TypeFilter;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.Heightmap;
import net.minecraft.world.World;
import net.minecraft.world.chunk.WorldChunk;

public final class DragonEggBeaconEffectHandler {
    private static final int PLAYER_CHUNK_SCAN_RADIUS = 2;
    private static final int SCAN_INTERVAL_TICKS = 20;
    private static final int PARTICLE_INTERVAL_TICKS = 20;
    private static final int DROPPED_EGG_RESPAWN_TICKS = 20 * 270;
    private static final int BEAM_BOTTOM_Y = -60;
    private static final int BEAM_TOP_Y = 312;
    private static final int PARTICLE_STEP_Y = 8;
    private static final String KEY_WORLD = "world";
    private static final String KEY_X = "x";
    private static final String KEY_Y = "y";
    private static final String KEY_Z = "z";
    private final UiBridgeManager uiBridgeManager;
    private final Path statePath;
    private final Map<ServerWorld, Set<BlockPos>> placedEggsByWorld = new IdentityHashMap<>();
    private Optional<PlacedEggLocation> rememberedPlacedEgg = Optional.empty();
    private Optional<PlacedEggLocation> lastAnnouncedPlacedEgg = Optional.empty();
    private DragonEggUiState lastUiState = DragonEggUiState.absent();
    private long ticks;

    public DragonEggBeaconEffectHandler(UiBridgeManager uiBridgeManager, Path statePath) {
        this.uiBridgeManager = uiBridgeManager;
        this.statePath = statePath;
    }

    public void register() {
        loadRememberedPlacedEgg();
        ServerTickEvents.END_SERVER_TICK.register(this::tick);
    }

    public DragonEggUiState currentUiState() {
        return lastUiState;
    }

    private void tick(MinecraftServer server) {
        ticks++;
        if (ticks % SCAN_INTERVAL_TICKS == 0) {
            scanPlacedEggs(server);
            handleDroppedEggRespawn(server);
            publishUiState(server);
        }

        if (ticks % PARTICLE_INTERVAL_TICKS == 0) {
            emitBeams(server);
        }
    }

    private void handleDroppedEggRespawn(MinecraftServer server) {
        DroppedEggStatus droppedEggs = droppedEggStatus(server);
        if (droppedEggs.needsRespawn()) {
            respawnDroppedEgg(server, "dropped too long or fell below the world");
            return;
        }

        if (droppedEggs.count() == 0 && lastUiState.kind() == DragonEggLocationKind.DROPPED && !hasNonDroppedEgg(server)) {
            respawnDroppedEgg(server, "vanilla despawned");
        }
    }

    private DroppedEggStatus droppedEggStatus(MinecraftServer server) {
        int count = 0;
        boolean needsRespawn = false;
        for (ServerWorld world : server.getWorlds()) {
            for (ItemEntity itemEntity : dragonEggItemEntities(world)) {
                count++;
                if (itemEntity.getItemAge() >= DROPPED_EGG_RESPAWN_TICKS || itemEntity.getY() <= world.getBottomY()) {
                    needsRespawn = true;
                }
            }
        }
        return new DroppedEggStatus(count, needsRespawn);
    }

    private void respawnDroppedEgg(MinecraftServer server, String reason) {
        removeDroppedEggItems(server);
        if (hasNonDroppedEgg(server)) {
            ShdLifestealMod.LOGGER.info("Skipped dragon egg End respawn after {} because another dragon egg already exists.", reason);
            return;
        }

        ServerWorld endWorld = server.getWorld(World.END);
        if (endWorld == null) {
            ShdLifestealMod.LOGGER.warn("Could not respawn dragon egg after {} because the End world is unavailable.", reason);
            return;
        }

        endWorld.getChunk(0, 0);
        int y = endWorld.getTopY(Heightmap.Type.MOTION_BLOCKING, 0, 0);
        BlockPos pos = new BlockPos(0, y, 0);
        if (!endWorld.getBlockState(pos).isOf(Blocks.DRAGON_EGG)) {
            endWorld.setBlockState(pos, Blocks.DRAGON_EGG.getDefaultState(), Block.NOTIFY_ALL);
        }

        rememberPlacedEgg(endWorld, pos);
        lastAnnouncedPlacedEgg = Optional.empty();
        ShdLifestealMod.LOGGER.info("Respawned dragon egg in the End at {} after {}.", pos.toShortString(), reason);
        server.getPlayerManager()
                .getPlayerList()
                .forEach(player -> player.sendMessage(Text.literal("Dragon Egg returned to the End at " + exactLocation(state(
                        DragonEggLocationKind.PLACED,
                        endWorld,
                        pos.getX(),
                        pos.getY(),
                        pos.getZ(),
                        true
                ))).formatted(Formatting.LIGHT_PURPLE), false));
    }

    private void removeDroppedEggItems(MinecraftServer server) {
        for (ServerWorld world : server.getWorlds()) {
            for (ItemEntity itemEntity : dragonEggItemEntities(world)) {
                itemEntity.discard();
            }
        }
    }

    private boolean hasNonDroppedEgg(MinecraftServer server) {
        validateRememberedPlacedEgg(server);
        if (rememberedPlacedEgg.isPresent()) {
            return true;
        }
        if (placedEggsByWorld.values().stream().anyMatch(placedEggs -> !placedEggs.isEmpty())) {
            return true;
        }

        for (ServerWorld world : server.getWorlds()) {
            if (!world.getEntitiesByType(TypeFilter.instanceOf(ItemFrameEntity.class), entity -> entity.getHeldItemStack().isOf(Items.DRAGON_EGG)).isEmpty()) {
                return true;
            }
            for (ServerPlayerEntity player : world.getPlayers()) {
                if (PlayerObjectiveInventoryScanner.carries(player, Items.DRAGON_EGG)) {
                    return true;
                }
            }
        }
        return false;
    }

    private List<? extends ItemEntity> dragonEggItemEntities(ServerWorld world) {
        return world.getEntitiesByType(TypeFilter.instanceOf(ItemEntity.class), entity -> entity.getStack().isOf(Items.DRAGON_EGG));
    }

    private void scanPlacedEggs(MinecraftServer server) {
        placedEggsByWorld.clear();
        validateRememberedPlacedEgg(server);
        for (ServerWorld world : server.getWorlds()) {
            Set<BlockPos> placedEggs = scanPlacedEggs(world);
            if (!placedEggs.isEmpty()) {
                placedEggsByWorld.put(world, placedEggs);
                if (rememberedPlacedEgg.isEmpty()) {
                    rememberPlacedEgg(world, placedEggs.iterator().next());
                }
            }
        }
        rememberedPlacedEgg.ifPresent(location -> world(server, location.world()).ifPresent(world ->
                placedEggsByWorld.computeIfAbsent(world, ignored -> new HashSet<>()).add(location.pos())
        ));
    }

    private Set<BlockPos> scanPlacedEggs(ServerWorld world) {
        Set<BlockPos> placedEggs = new HashSet<>();
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
                    if (chunk != null) {
                        scanChunk(world, chunkX, chunkZ, placedEggs);
                    }
                }
            }
        }
        return placedEggs;
    }

    private void scanChunk(ServerWorld world, int chunkX, int chunkZ, Set<BlockPos> placedEggs) {
        int startX = chunkX << 4;
        int startZ = chunkZ << 4;
        int bottomY = Math.max(BEAM_BOTTOM_Y, world.getBottomY());
        int topY = BEAM_TOP_Y;
        BlockPos.Mutable mutablePos = new BlockPos.Mutable();

        for (int x = startX; x < startX + 16; x++) {
            for (int z = startZ; z < startZ + 16; z++) {
                for (int y = bottomY; y <= topY; y++) {
                    mutablePos.set(x, y, z);
                    if (world.getBlockState(mutablePos).isOf(Blocks.DRAGON_EGG)) {
                        placedEggs.add(mutablePos.toImmutable());
                    }
                }
            }
        }
    }

    private void emitBeams(MinecraftServer server) {
        for (ServerWorld world : server.getWorlds()) {
            Set<BlockPos> placedEggs = placedEggsByWorld.getOrDefault(world, Set.of());
            for (BlockPos pos : placedEggs) {
                emitBeam(world, pos.getX() + 0.5D, pos.getZ() + 0.5D);
            }

            for (ItemFrameEntity itemFrame : world.getEntitiesByType(TypeFilter.instanceOf(ItemFrameEntity.class), entity -> true)) {
                if (itemFrame.getHeldItemStack().isOf(Items.DRAGON_EGG)) {
                    emitBeam(world, itemFrame.getX(), itemFrame.getZ());
                }
            }

            for (ItemEntity itemEntity : world.getEntitiesByType(TypeFilter.instanceOf(ItemEntity.class), entity -> entity.getStack().isOf(Items.DRAGON_EGG))) {
                emitBeam(world, itemEntity.getX(), itemEntity.getZ());
            }
        }
    }

    private void emitBeam(ServerWorld world, double x, double z) {
        int bottomY = Math.max(BEAM_BOTTOM_Y, world.getBottomY());
        int topY = BEAM_TOP_Y;
        for (int y = bottomY; y <= topY; y += PARTICLE_STEP_Y) {
            world.spawnParticles(ParticleTypes.END_ROD, x, y + 0.5D, z, 1, 0.03D, 0.0D, 0.03D, 0.0D);
        }
    }

    private void publishUiState(MinecraftServer server) {
        DragonEggUiState state = findUiState(server);
        if (!state.equals(lastUiState)) {
            DragonEggUiState previous = lastUiState;
            lastUiState = state;
            uiBridgeManager.onDragonEggStateChanged(state);
            publishChatMessage(server, previous, state);
        }
    }

    private void publishChatMessage(MinecraftServer server, DragonEggUiState previous, DragonEggUiState state) {
        if (state.kind() != DragonEggLocationKind.PLACED) {
            return;
        }

        PlacedEggLocation placedLocation = PlacedEggLocation.from(state);
        if (lastAnnouncedPlacedEgg.filter(placedLocation::equals).isPresent()) {
            return;
        }

        lastAnnouncedPlacedEgg = Optional.of(placedLocation);
        String message = "Dragon Egg placed at " + exactLocation(state);
        server.getPlayerManager()
                .getPlayerList()
                .forEach(player -> player.sendMessage(Text.literal(message).formatted(Formatting.LIGHT_PURPLE), false));
    }

    private String exactLocation(DragonEggUiState state) {
        return "%s %d %d %d".formatted(state.world(), state.x(), state.y(), state.z());
    }

    private DragonEggUiState findUiState(MinecraftServer server) {
        Optional<DragonEggUiState> rememberedState = rememberedPlacedEgg
                .flatMap(location -> world(server, location.world())
                        .map(world -> state(
                                DragonEggLocationKind.PLACED,
                                world,
                                location.pos().getX(),
                                location.pos().getY(),
                                location.pos().getZ(),
                                true
                        )));
        if (rememberedState.isPresent()) {
            return rememberedState.get();
        }

        for (Map.Entry<ServerWorld, Set<BlockPos>> entry : placedEggsByWorld.entrySet()) {
            for (BlockPos pos : entry.getValue()) {
                return state(DragonEggLocationKind.PLACED, entry.getKey(), pos.getX(), pos.getY(), pos.getZ(), true);
            }
        }

        for (ServerWorld world : server.getWorlds()) {
            for (ItemFrameEntity itemFrame : world.getEntitiesByType(TypeFilter.instanceOf(ItemFrameEntity.class), entity -> entity.getHeldItemStack().isOf(Items.DRAGON_EGG))) {
                return state(
                        DragonEggLocationKind.ITEM_FRAME,
                        world,
                        itemFrame.getBlockPos().getX(),
                        itemFrame.getBlockPos().getY(),
                        itemFrame.getBlockPos().getZ(),
                        true
                );
            }
        }

        for (ServerWorld world : server.getWorlds()) {
            for (ItemEntity itemEntity : world.getEntitiesByType(TypeFilter.instanceOf(ItemEntity.class), entity -> entity.getStack().isOf(Items.DRAGON_EGG))) {
                return state(
                        DragonEggLocationKind.DROPPED,
                        world,
                        itemEntity.getBlockPos().getX(),
                        itemEntity.getBlockPos().getY(),
                        itemEntity.getBlockPos().getZ(),
                        true
                );
            }
        }

        for (ServerWorld world : server.getWorlds()) {
            for (ServerPlayerEntity player : world.getPlayers()) {
                if (PlayerObjectiveInventoryScanner.carries(player, Items.DRAGON_EGG)) {
                    return state(
                            DragonEggLocationKind.CARRIED,
                            world,
                            player.getBlockPos().getX(),
                            player.getBlockPos().getY(),
                            player.getBlockPos().getZ(),
                            true
                    );
                }
            }
        }

        return DragonEggUiState.absent();
    }

    private DragonEggUiState state(DragonEggLocationKind kind, ServerWorld world, int x, int y, int z, boolean exact) {
        return new DragonEggUiState(kind, world.getRegistryKey().getValue().toString(), x, y, z, exact);
    }

    private void validateRememberedPlacedEgg(MinecraftServer server) {
        rememberedPlacedEgg.ifPresent(location -> world(server, location.world()).ifPresent(world -> {
            ChunkPos chunkPos = new ChunkPos(location.pos());
            if (!world.getChunkManager().isChunkLoaded(chunkPos.x, chunkPos.z)) {
                return;
            }
            if (!world.getBlockState(location.pos()).isOf(Blocks.DRAGON_EGG)) {
                rememberedPlacedEgg = Optional.empty();
                saveRememberedPlacedEgg();
            }
        }));
    }

    private void rememberPlacedEgg(ServerWorld world, BlockPos pos) {
        PlacedEggLocation location = new PlacedEggLocation(world.getRegistryKey().getValue().toString(), pos.toImmutable());
        if (rememberedPlacedEgg.filter(location::equals).isPresent()) {
            return;
        }

        rememberedPlacedEgg = Optional.of(location);
        saveRememberedPlacedEgg();
    }

    private Optional<ServerWorld> world(MinecraftServer server, String worldId) {
        for (ServerWorld world : server.getWorlds()) {
            if (world.getRegistryKey().getValue().toString().equals(worldId)) {
                return Optional.of(world);
            }
        }
        return Optional.empty();
    }

    private void loadRememberedPlacedEgg() {
        if (!Files.exists(statePath)) {
            return;
        }

        Properties properties = new Properties();
        try (InputStream input = Files.newInputStream(statePath)) {
            properties.load(input);
            String world = properties.getProperty(KEY_WORLD, "");
            int x = Integer.parseInt(properties.getProperty(KEY_X, "0"));
            int y = Integer.parseInt(properties.getProperty(KEY_Y, "0"));
            int z = Integer.parseInt(properties.getProperty(KEY_Z, "0"));
            rememberedPlacedEgg = Optional.of(new PlacedEggLocation(world, new BlockPos(x, y, z)));
            lastAnnouncedPlacedEgg = rememberedPlacedEgg;
        } catch (IOException | NumberFormatException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to load dragon egg location", exception);
            rememberedPlacedEgg = Optional.empty();
            lastAnnouncedPlacedEgg = Optional.empty();
        }
    }

    private void saveRememberedPlacedEgg() {
        try {
            if (rememberedPlacedEgg.isEmpty()) {
                Files.deleteIfExists(statePath);
                return;
            }

            PlacedEggLocation location = rememberedPlacedEgg.get();
            Files.createDirectories(statePath.getParent());
            Properties properties = new Properties();
            properties.setProperty(KEY_WORLD, location.world());
            properties.setProperty(KEY_X, Integer.toString(location.pos().getX()));
            properties.setProperty(KEY_Y, Integer.toString(location.pos().getY()));
            properties.setProperty(KEY_Z, Integer.toString(location.pos().getZ()));
            try (OutputStream output = Files.newOutputStream(statePath)) {
                properties.store(output, "SHD Lifesteal remembered dragon egg block location");
            }
        } catch (IOException exception) {
            ShdLifestealMod.LOGGER.warn("Failed to save dragon egg location", exception);
        }
    }

    private record PlacedEggLocation(String world, BlockPos pos) {
        private static PlacedEggLocation from(DragonEggUiState state) {
            return new PlacedEggLocation(state.world(), new BlockPos(state.x(), state.y(), state.z()));
        }
    }

    private record DroppedEggStatus(int count, boolean needsRespawn) {
    }

}
