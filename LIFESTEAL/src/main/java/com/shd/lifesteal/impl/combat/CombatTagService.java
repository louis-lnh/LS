package com.shd.lifesteal.impl.combat;

import com.shd.lifesteal.impl.config.LifestealConfig;
import com.shd.lifesteal.impl.ui.UiBridgeManager;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class CombatTagService {
    private final LifestealConfig config;
    private final UiBridgeManager uiBridgeManager;
    private final Map<UUID, CombatTag> tags = new ConcurrentHashMap<>();

    public CombatTagService(LifestealConfig config, UiBridgeManager uiBridgeManager) {
        this.config = config;
        this.uiBridgeManager = uiBridgeManager;
    }

    public void tag(UUID attacker, UUID victim, Instant now) {
        Instant expiresAt = now.plus(config.combatTagDuration());
        tags.put(attacker, new CombatTag(attacker, victim, expiresAt));
        tags.put(victim, new CombatTag(victim, attacker, expiresAt));
        uiBridgeManager.onCombatTagChanged(attacker, true, (int) config.combatTagDuration().toSeconds());
        uiBridgeManager.onCombatTagChanged(victim, true, (int) config.combatTagDuration().toSeconds());
    }

    public Optional<UUID> recentAttacker(UUID playerId, Instant now) {
        CombatTag tag = tags.get(playerId);
        if (tag == null || tag.expired(now)) {
            tags.remove(playerId);
            uiBridgeManager.onCombatTagChanged(playerId, false, 0);
            return Optional.empty();
        }
        return Optional.of(tag.recentAttacker());
    }

    public Optional<CombatTagSnapshot> snapshot(UUID playerId, Instant now) {
        CombatTag tag = tags.get(playerId);
        if (tag == null || tag.expired(now)) {
            tags.remove(playerId);
            uiBridgeManager.onCombatTagChanged(playerId, false, 0);
            return Optional.empty();
        }

        long remainingSeconds = Math.max(0L, tag.expiresAt().getEpochSecond() - now.getEpochSecond());
        return Optional.of(new CombatTagSnapshot(playerId, tag.recentAttacker(), (int) remainingSeconds));
    }

    public boolean isTagged(UUID playerId, Instant now) {
        return recentAttacker(playerId, now).isPresent();
    }

    public void clear(UUID playerId) {
        tags.remove(playerId);
        uiBridgeManager.onCombatTagChanged(playerId, false, 0);
    }
}
