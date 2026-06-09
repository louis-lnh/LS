package com.shd.lifesteal.impl.heart;

import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.api.GameplayRoleSnapshot;
import com.shd.lifesteal.api.HeartChangeReason;
import com.shd.lifesteal.api.HeartChangeResult;
import com.shd.lifesteal.api.LifestealService;
import com.shd.lifesteal.api.PlayerHeartState;
import com.shd.lifesteal.impl.config.LifestealConfig;
import com.shd.lifesteal.impl.data.LifestealRepository;
import com.shd.lifesteal.impl.data.PlayerData;
import com.shd.lifesteal.impl.elimination.EliminationService;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.objective.PlayerObjectiveInventoryScanner;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import net.minecraft.item.Items;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

public final class HeartService implements LifestealService {
    private final LifestealConfig config;
    private final LifestealRepository repository;
    private final EliminationService eliminationService;
    private final GracePeriodService gracePeriodService;
    private final UiBridgeManager uiBridgeManager;

    public HeartService(
            LifestealConfig config,
            LifestealRepository repository,
            EliminationService eliminationService,
            GracePeriodService gracePeriodService,
            UiBridgeManager uiBridgeManager
    ) {
        this.config = config;
        this.repository = repository;
        this.eliminationService = eliminationService;
        this.gracePeriodService = gracePeriodService;
        this.uiBridgeManager = uiBridgeManager;
    }

    @Override
    public int startingHearts() {
        return config.startingHearts();
    }

    @Override
    public int maxHearts() {
        return config.maxHearts();
    }

    @Override
    public Optional<PlayerHeartState> heartState(UUID playerId) {
        return repository.findPlayer(playerId).map(this::toApiState);
    }

    public PlayerHeartState ensurePlayer(UUID playerId) {
        return toApiState(getOrCreate(playerId));
    }

    @Override
    public HeartChangeResult setHearts(UUID playerId, int hearts, HeartChangeReason reason) {
        PlayerData current = getOrCreate(playerId);
        int clamped = Math.max(1, Math.min(config.maxHearts(), hearts));
        PlayerData saved = repository.savePlayer(current.withHearts(clamped));
        PlayerHeartState state = toApiState(saved);
        uiBridgeManager.onPlayerHeartStateChanged(state);
        return new HeartChangeResult(playerId, current.hearts(), saved.hearts(), reason, current.hearts() != saved.hearts());
    }

    @Override
    public HeartChangeResult addHearts(UUID playerId, int amount, HeartChangeReason reason) {
        PlayerData current = getOrCreate(playerId);
        return setHearts(playerId, current.hearts() + amount, reason);
    }

    @Override
    public HeartChangeResult removeHearts(UUID playerId, int amount, HeartChangeReason reason) {
        PlayerData current = getOrCreate(playerId);
        return setHearts(playerId, current.hearts() - amount, reason);
    }

    public PlayerHeartState eliminate(UUID playerId) {
        PlayerData current = getOrCreate(playerId);
        PlayerData saved = repository.savePlayer(current.withEliminated(true).withHearts(Math.max(1, current.hearts())));
        PlayerHeartState state = toApiState(saved);
        uiBridgeManager.onPlayerHeartStateChanged(state);
        return state;
    }

    public PlayerHeartState revive(UUID playerId) {
        PlayerData current = getOrCreate(playerId);
        PlayerData saved = repository.savePlayer(current.withEliminated(false).withHearts(config.revivalHearts()));
        PlayerHeartState state = toApiState(saved);
        uiBridgeManager.onPlayerHeartStateChanged(state);
        return state;
    }

    public PlayerHeartState reset(UUID playerId) {
        PlayerData current = getOrCreate(playerId);
        PlayerData saved = repository.savePlayer(current.withEliminated(false).withHearts(config.startingHearts()));
        PlayerHeartState state = toApiState(saved);
        uiBridgeManager.onPlayerHeartStateChanged(state);
        return state;
    }

    public DeathResolutionResult resolveDeath(UUID victimId, Optional<UUID> creditedKiller) {
        PlayerData current = getOrCreate(victimId);
        if (gracePeriodService.snapshot().active()) {
            PlayerData saved = repository.savePlayer(current.withDeathAdded());
            return new DeathResolutionResult(
                    victimId,
                    current.hearts(),
                    saved.hearts(),
                    false,
                    saved.eliminated(),
                    true,
                    Optional.empty(),
                    Optional.empty(),
                    false
            );
        }

        if (current.hearts() <= 1) {
            PlayerData saved = repository.savePlayer(current.withDeathAdded().withEliminated(true).withHearts(1));
            PlayerHeartState state = toApiState(saved);
            uiBridgeManager.onPlayerHeartStateChanged(state);
            return new DeathResolutionResult(
                    victimId,
                    current.hearts(),
                    saved.hearts(),
                    true,
                    true,
                    false,
                    Optional.empty(),
                    Optional.empty(),
                    false
            );
        }

        PlayerData saved = repository.savePlayer(current.withDeathAdded().withHearts(current.hearts() - 1));
        PlayerHeartState state = toApiState(saved);
        uiBridgeManager.onPlayerHeartStateChanged(state);
        Optional<UUID> validKiller = creditedKiller.filter(killerId -> !killerId.equals(victimId));
        Optional<HeartChangeResult> killerHeartResult = Optional.empty();
        boolean dropHeartItem = validKiller.isEmpty();

        if (validKiller.isPresent()) {
            PlayerData killer = getOrCreate(validKiller.get());
            if (killer.hearts() >= config.maxHearts()) {
                repository.savePlayer(killer.withKillAdded());
                dropHeartItem = true;
            } else {
                PlayerData savedKiller = repository.savePlayer(killer.withKillAdded().withHearts(killer.hearts() + 1));
                PlayerHeartState killerState = toApiState(savedKiller);
                uiBridgeManager.onPlayerHeartStateChanged(killerState);
                killerHeartResult = Optional.of(new HeartChangeResult(
                        savedKiller.playerId(),
                        killer.hearts(),
                        savedKiller.hearts(),
                        HeartChangeReason.KILL_REWARD,
                        true
                ));
            }
        }

        return new DeathResolutionResult(
                victimId,
                current.hearts(),
                saved.hearts(),
                false,
                saved.eliminated(),
                false,
                validKiller,
                killerHeartResult,
                dropHeartItem
        );
    }

    @Override
    public boolean isEliminated(UUID playerId) {
        return eliminationService.isEliminated(playerId);
    }

    @Override
    public GracePeriodSnapshot gracePeriod() {
        return gracePeriodService.snapshot();
    }

    @Override
    public List<GameplayRoleSnapshot> gameplayRoles(MinecraftServer server) {
        Map<UUID, GameplayRoleSnapshot> snapshots = new LinkedHashMap<>();
        for (PlayerData playerData : repository.findPlayers()) {
            snapshots.put(playerData.playerId(), new GameplayRoleSnapshot(
                    playerData.playerId(),
                    playerData.hearts(),
                    playerData.eliminated(),
                    playerData.kills(),
                    playerData.deaths(),
                    playerData.revivals(),
                    playerData.hearts() >= config.maxHearts(),
                    false,
                    false
            ));
        }

        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            PlayerData playerData = getOrCreate(player.getUuid());
            snapshots.put(player.getUuid(), new GameplayRoleSnapshot(
                    player.getUuid(),
                    playerData.hearts(),
                    playerData.eliminated(),
                    playerData.kills(),
                    playerData.deaths(),
                    playerData.revivals(),
                    playerData.hearts() >= config.maxHearts(),
                    PlayerObjectiveInventoryScanner.carries(player, Items.DRAGON_EGG),
                    PlayerObjectiveInventoryScanner.carries(player, Items.MACE)
            ));
        }

        return List.copyOf(snapshots.values());
    }

    PlayerData getOrCreate(UUID playerId) {
        return repository.findPlayer(playerId).orElseGet(() -> repository.savePlayer(new PlayerData(
                playerId,
                config.startingHearts(),
                false,
                0,
                0,
                0
        )));
    }

    private PlayerHeartState toApiState(PlayerData playerData) {
        return new PlayerHeartState(playerData.playerId(), playerData.hearts(), playerData.eliminated());
    }
}
