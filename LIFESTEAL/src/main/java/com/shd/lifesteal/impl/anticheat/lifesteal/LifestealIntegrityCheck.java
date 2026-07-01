package com.shd.lifesteal.impl.anticheat.lifesteal;

import com.shd.lifesteal.api.GracePeriodSnapshot;
import com.shd.lifesteal.api.PlayerHeartState;
import com.shd.lifesteal.impl.anticheat.AntiCheatAction;
import com.shd.lifesteal.impl.anticheat.AntiCheatCategory;
import com.shd.lifesteal.impl.anticheat.AntiCheatCheck;
import com.shd.lifesteal.impl.anticheat.AntiCheatCheckContext;
import com.shd.lifesteal.impl.anticheat.AntiCheatDetection;
import com.shd.lifesteal.impl.anticheat.AntiCheatServerTickContext;
import com.shd.lifesteal.impl.anticheat.AntiCheatSeverity;
import com.shd.lifesteal.impl.combat.CombatTagService;
import com.shd.lifesteal.impl.dragon.DragonEggBeaconEffectHandler;
import com.shd.lifesteal.impl.event.EventTimerService;
import com.shd.lifesteal.impl.grace.GracePeriodService;
import com.shd.lifesteal.impl.heart.HeartService;
import com.shd.lifesteal.impl.item.ModItems;
import com.shd.lifesteal.impl.restriction.MaceLimitRules;
import com.shd.lifesteal.api.ui.DragonEggLocationKind;
import com.shd.lifesteal.api.ui.DragonEggUiState;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.BundleContentsComponent;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.decoration.ItemFrameEntity;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.Registries;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.TypeFilter;
import net.minecraft.world.World;

public final class LifestealIntegrityCheck implements AntiCheatCheck {
    private final HeartService heartService;
    private final GracePeriodService gracePeriodService;
    private final CombatTagService combatTagService;
    private final ModItems modItems;
    private final DragonEggBeaconEffectHandler dragonEggBeaconEffectHandler;
    private final EventTimerService eventTimerService;
    private final Map<UUID, Integer> previousHearts = new HashMap<>();
    private final Map<String, Long> lastAlertTicks = new HashMap<>();

    public LifestealIntegrityCheck(
            HeartService heartService,
            GracePeriodService gracePeriodService,
            CombatTagService combatTagService,
            ModItems modItems,
            DragonEggBeaconEffectHandler dragonEggBeaconEffectHandler,
            EventTimerService eventTimerService
    ) {
        this.heartService = heartService;
        this.gracePeriodService = gracePeriodService;
        this.combatTagService = combatTagService;
        this.modItems = modItems;
        this.dragonEggBeaconEffectHandler = dragonEggBeaconEffectHandler;
        this.eventTimerService = eventTimerService;
    }

    @Override
    public String id() {
        return "lifesteal_integrity";
    }

    @Override
    public void tick(AntiCheatCheckContext context) {
        if (!context.settings().lifestealChecksEnabled()
                || context.tick() % context.settings().lifestealScanIntervalTicks() != 0) {
            return;
        }

        ServerPlayerEntity player = context.player();
        Optional<PlayerHeartState> optionalState = heartService.heartState(player.getUuid());
        if (optionalState.isEmpty()) {
            alert(context, AntiCheatCategory.HEART_INTEGRITY, AntiCheatSeverity.HIGH, "lifesteal_missing_player_state", "Missing Lifesteal player state detected",
                    "player=%s uuid=%s online=true".formatted(player.getName().getString(), player.getUuidAsString()));
            return;
        }

        PlayerHeartState state = optionalState.get();
        GracePeriodSnapshot grace = gracePeriodService.snapshot();
        Instant now = Instant.now();
        boolean combatTagged = combatTagService.snapshot(player.getUuid(), now).isPresent();

        checkHeartBounds(context, player, state);
        checkAppliedHealth(context, player, state);
        checkEliminatedActive(context, player, state, combatTagged);
        checkGracePeriodConsistency(context, player, state, grace, combatTagged);
        checkProtectedItems(context, player);
        checkEndAccess(context, player);
        if (isFirstOnlinePlayer(context)) {
            checkMaceRegistry(context);
            checkDragonEggObjective(context);
            checkEventTimerConsistency(context);
        }

        previousHearts.put(player.getUuid(), state.hearts());
    }

    @Override
    public void endServerTick(AntiCheatServerTickContext context) {
        previousHearts.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
        lastAlertTicks.keySet().removeIf(key -> {
            int separator = key.indexOf('|');
            if (separator <= 0) {
                return true;
            }
            try {
                return !context.onlinePlayers().contains(UUID.fromString(key.substring(0, separator)));
            } catch (IllegalArgumentException ignored) {
                return true;
            }
        });
    }

    private void checkHeartBounds(AntiCheatCheckContext context, ServerPlayerEntity player, PlayerHeartState state) {
        if (state.eliminated()) {
            if (state.hearts() != 0) {
                alert(context, AntiCheatCategory.HEART_INTEGRITY, AntiCheatSeverity.CRITICAL, "lifesteal_eliminated_hearts_nonzero", "Eliminated player heart state mismatch detected",
                        "player=%s uuid=%s hearts=%d eliminated=true expectedHearts=0".formatted(player.getName().getString(), player.getUuidAsString(), state.hearts()));
            }
            return;
        }

        if (state.hearts() < 1 || state.hearts() > heartService.maxHearts()) {
            alert(context, AntiCheatCategory.HEART_INTEGRITY, AntiCheatSeverity.CRITICAL, "lifesteal_heart_bounds", "Impossible Lifesteal heart count detected",
                    "player=%s uuid=%s hearts=%d min=1 max=%d eliminated=false".formatted(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            state.hearts(),
                            heartService.maxHearts()
                    ));
        }
    }

    private void checkAppliedHealth(AntiCheatCheckContext context, ServerPlayerEntity player, PlayerHeartState state) {
        if (state.eliminated()) {
            return;
        }

        EntityAttributeInstance maxHealth = player.getAttributeInstance(EntityAttributes.MAX_HEALTH);
        if (maxHealth == null) {
            return;
        }

        double expected = state.hearts() * 2.0D;
        double actual = maxHealth.getBaseValue();
        if (Math.abs(actual - expected) <= 0.1D) {
            return;
        }

        alert(context, AntiCheatCategory.HEART_INTEGRITY, AntiCheatSeverity.HIGH, "lifesteal_applied_health_mismatch", "Applied health does not match Lifesteal heart state",
                "player=%s uuid=%s hearts=%d expectedMaxHealth=%.1f actualMaxHealth=%.1f currentHealth=%.1f".formatted(
                        player.getName().getString(),
                        player.getUuidAsString(),
                        state.hearts(),
                        expected,
                        actual,
                        player.getHealth()
                ));
    }

    private void checkEliminatedActive(AntiCheatCheckContext context, ServerPlayerEntity player, PlayerHeartState state, boolean combatTagged) {
        if (!state.eliminated() && !heartService.isEliminated(player.getUuid())) {
            return;
        }

        alert(context, AntiCheatCategory.ELIMINATION, AntiCheatSeverity.CRITICAL, "lifesteal_eliminated_player_active", "Eliminated player is active on the server",
                "player=%s uuid=%s hearts=%d eliminated=%s combatTagged=%s creative=%s spectator=%s".formatted(
                        player.getName().getString(),
                        player.getUuidAsString(),
                        state.hearts(),
                        state.eliminated(),
                        combatTagged,
                        player.isCreative(),
                        player.isSpectator()
                ));
    }

    private void checkGracePeriodConsistency(
            AntiCheatCheckContext context,
            ServerPlayerEntity player,
            PlayerHeartState state,
            GracePeriodSnapshot grace,
            boolean combatTagged
    ) {
        if (!grace.active()) {
            return;
        }

        if (combatTagged) {
            alert(context, AntiCheatCategory.GRACE_PERIOD, AntiCheatSeverity.HIGH, "lifesteal_grace_combat_tag", "Combat tag active during grace period",
                    "player=%s uuid=%s hearts=%d gracePaused=%s graceRemainingSeconds=%d".formatted(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            state.hearts(),
                            grace.paused(),
                            grace.remaining().toSeconds()
                    ));
        }

        Integer previous = previousHearts.get(player.getUuid());
        if (previous == null || previous == state.hearts()) {
            return;
        }

        alert(context, AntiCheatCategory.GRACE_PERIOD, AntiCheatSeverity.WARNING, "lifesteal_grace_heart_change", "Heart state changed during grace period",
                "player=%s uuid=%s previousHearts=%d currentHearts=%d gracePaused=%s graceRemainingSeconds=%d".formatted(
                        player.getName().getString(),
                        player.getUuidAsString(),
                        previous,
                        state.hearts(),
                        grace.paused(),
                        grace.remaining().toSeconds()
                ));
    }

    private void checkProtectedItems(AntiCheatCheckContext context, ServerPlayerEntity player) {
        int dragonEggCount = 0;
        int trackedMaceCount = 0;
        for (int slot = 0; slot < player.getInventory().size(); slot++) {
            ItemStack stack = player.getInventory().getStack(slot);
            dragonEggCount += countItem(stack, Items.DRAGON_EGG);
            if (MaceLimitRules.trackedMaceKey(stack).isPresent()) {
                trackedMaceCount++;
            }
            checkProtectedStack(context, player, stack, "inventory:" + slot);
        }

        ItemStack cursorStack = player.currentScreenHandler.getCursorStack();
        dragonEggCount += countItem(cursorStack, Items.DRAGON_EGG);
        if (MaceLimitRules.trackedMaceKey(cursorStack).isPresent()) {
            trackedMaceCount++;
        }
        checkProtectedStack(context, player, cursorStack, "cursor");

        if (dragonEggCount > 1) {
            alert(context, AntiCheatCategory.DRAGON_EGG, AntiCheatSeverity.CRITICAL, "lifesteal_dragon_egg_duplicate_player", "Possible Dragon Egg duplication detected",
                    "player=%s uuid=%s dragonEggCount=%d location=player_inventory".formatted(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            dragonEggCount
                    ));
        }

        if (trackedMaceCount > MaceLimitRules.MAX_ACTIVE_MACES) {
            alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_tracked_mace_overlimit_player", "Too many tracked event maces carried by one player",
                    "player=%s uuid=%s trackedMaceCount=%d maxActiveMaces=%d".formatted(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            trackedMaceCount,
                            MaceLimitRules.MAX_ACTIVE_MACES
                    ));
        }
    }

    private void checkProtectedStack(AntiCheatCheckContext context, ServerPlayerEntity player, ItemStack stack, String location) {
        if (stack.isEmpty()) {
            return;
        }

        if (MaceLimitRules.isInvalidMace(stack)) {
            alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_invalid_mace_player_item", "Invalid non-event mace detected",
                    "player=%s uuid=%s location=%s item=%s itemId=%s".formatted(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            location,
                            stack.getName().getString(),
                            itemId(stack)
                    ));
        }

        MaceLimitRules.customMaceIntegrityIssue(stack).ifPresent(issue -> alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_custom_mace_tamper", "Custom event mace integrity mismatch detected",
                "player=%s uuid=%s location=%s item=%s itemId=%s issue=\"%s\" identity=%s tracked=%s".formatted(
                        player.getName().getString(),
                        player.getUuidAsString(),
                        location,
                        stack.getName().getString(),
                        itemId(stack),
                        issue,
                        MaceLimitRules.maceIdentity(stack).orElse("none"),
                        MaceLimitRules.trackedMaceKey(stack).isPresent()
                )));

        BundleContentsComponent bundleContents = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
        if (bundleContents == null || bundleContents.isEmpty()) {
            return;
        }

        int bundledHearts = 0;
        int bundledDragonEggs = 0;
        int bundledTrackedMaces = 0;
        int index = 0;
        for (ItemStack bundledStack : bundleContents.iterateCopy()) {
            bundledHearts += countItem(bundledStack, modItems.heart());
            bundledDragonEggs += countItem(bundledStack, Items.DRAGON_EGG);
            if (MaceLimitRules.trackedMaceKey(bundledStack).isPresent()) {
                bundledTrackedMaces++;
            }
            if (MaceLimitRules.isInvalidMace(bundledStack)) {
                alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_invalid_mace_bundle", "Invalid non-event mace hidden in bundle",
                        "player=%s uuid=%s location=%s bundleIndex=%d item=%s itemId=%s".formatted(
                                player.getName().getString(),
                                player.getUuidAsString(),
                                location,
                                index,
                                bundledStack.getName().getString(),
                                itemId(bundledStack)
                        ));
            }
            int bundleIndex = index;
            MaceLimitRules.customMaceIntegrityIssue(bundledStack).ifPresent(issue -> alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_custom_mace_bundle_tamper", "Custom event mace integrity mismatch detected inside bundle",
                    "player=%s uuid=%s location=%s bundleIndex=%d item=%s itemId=%s issue=\"%s\" identity=%s tracked=%s".formatted(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            location,
                            bundleIndex,
                            bundledStack.getName().getString(),
                            itemId(bundledStack),
                            issue,
                            MaceLimitRules.maceIdentity(bundledStack).orElse("none"),
                            MaceLimitRules.trackedMaceKey(bundledStack).isPresent()
                    )));
            index++;
        }

        if (bundledHearts > 0 || bundledDragonEggs > 0 || bundledTrackedMaces > 0) {
            alert(context, AntiCheatCategory.RESTRICTED_ITEM, AntiCheatSeverity.HIGH, "lifesteal_protected_item_bundle", "Protected Lifesteal item hidden in bundle",
                    "player=%s uuid=%s location=%s bundledHearts=%d bundledDragonEggs=%d bundledTrackedMaces=%d".formatted(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            location,
                            bundledHearts,
                            bundledDragonEggs,
                            bundledTrackedMaces
                    ));
        }
    }

    private int countItem(ItemStack stack, Item item) {
        if (stack.isEmpty()) {
            return 0;
        }

        int total = stack.isOf(item) ? stack.getCount() : 0;
        BundleContentsComponent bundleContents = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
        if (bundleContents == null || bundleContents.isEmpty()) {
            return total;
        }
        for (ItemStack bundledStack : bundleContents.iterateCopy()) {
            total += countItem(bundledStack, item);
        }
        return total;
    }

    private String itemId(ItemStack stack) {
        return stack.isEmpty() ? "empty" : Registries.ITEM.getId(stack.getItem()).toString();
    }

    private void checkEndAccess(AntiCheatCheckContext context, ServerPlayerEntity player) {
        if (!context.settings().lifestealEndAccessRequiresEvent()) {
            return;
        }

        if (!player.getEntityWorld().getRegistryKey().equals(World.END)) {
            return;
        }

        EventTimerService.Snapshot event = eventTimerService.snapshot();
        String marker = context.settings().lifestealEndEventNameMarker();
        boolean endOpen = event.active()
                && !event.paused()
                && (marker.isBlank() || event.name().toLowerCase(java.util.Locale.ROOT).contains(marker));
        if (endOpen) {
            return;
        }

        alert(context, AntiCheatCategory.EVENT_STATE, AntiCheatSeverity.CRITICAL, "lifesteal_end_access_before_event", "End access before event opening detected",
                "player=%s uuid=%s world=%s pos=%.1f,%.1f,%.1f eventActive=%s eventPaused=%s eventName=\"%s\" marker=\"%s\"".formatted(
                        player.getName().getString(),
                        player.getUuidAsString(),
                        player.getEntityWorld().getRegistryKey().getValue(),
                        player.getX(),
                        player.getY(),
                        player.getZ(),
                        event.active(),
                        event.paused(),
                        event.name(),
                        marker
                ));
    }

    private void checkEventTimerConsistency(AntiCheatCheckContext context) {
        EventTimerService.Snapshot event = eventTimerService.snapshot();
        if (!event.active()) {
            return;
        }

        if (event.name().isBlank()) {
            alert(context, AntiCheatCategory.EVENT_STATE, AntiCheatSeverity.HIGH, "lifesteal_event_timer_blank_name", "Active event timer has no event name",
                    "paused=%s remainingSeconds=%d".formatted(event.paused(), event.remaining().toSeconds()));
        }

        if (event.remaining().isNegative() || event.remaining().isZero()) {
            alert(context, AntiCheatCategory.EVENT_STATE, AntiCheatSeverity.HIGH, "lifesteal_event_timer_invalid_remaining", "Active event timer has invalid remaining time",
                    "eventName=\"%s\" paused=%s remainingMillis=%d".formatted(event.name(), event.paused(), event.remaining().toMillis()));
        }
    }

    private void checkMaceRegistry(AntiCheatCheckContext context) {
        Set<String> instanceIds = new HashSet<>();
        Map<String, Integer> keys = new HashMap<>();
        for (MaceLimitRules.ActiveMaceSnapshot snapshot : MaceLimitRules.activeMaceSnapshots()) {
            if (snapshot.instanceId() == null || snapshot.instanceId().isBlank()) {
                alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_mace_registry_blank_instance", "Tracked mace registry contains a blank instance",
                        "maceKey=%s location=%s owner=%s ownerId=%s".formatted(snapshot.maceKey(), snapshot.location(), snapshot.ownerName(), snapshot.ownerId()));
                continue;
            }
            if (!instanceIds.add(snapshot.instanceId())) {
                alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_mace_registry_duplicate_instance", "Tracked mace registry contains a duplicate instance",
                        "instanceId=%s maceKey=%s location=%s owner=%s ownerId=%s".formatted(snapshot.instanceId(), snapshot.maceKey(), snapshot.location(), snapshot.ownerName(), snapshot.ownerId()));
            }
            keys.merge(snapshot.maceKey(), 1, Integer::sum);
        }

        if (MaceLimitRules.activeMaceSnapshots().size() > MaceLimitRules.MAX_ACTIVE_MACES) {
            alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_mace_registry_overlimit", "Tracked mace registry exceeds active mace limit",
                    "activeMaces=%d maxActiveMaces=%d keys=%s".formatted(
                            MaceLimitRules.activeMaceSnapshots().size(),
                            MaceLimitRules.MAX_ACTIVE_MACES,
                            keys
                    ));
        }

        for (Map.Entry<String, Integer> entry : keys.entrySet()) {
            if (entry.getValue() > 1) {
                alert(context, AntiCheatCategory.CUSTOM_MACE, AntiCheatSeverity.CRITICAL, "lifesteal_mace_registry_duplicate_key", "Tracked mace registry contains duplicate active mace keys",
                        "maceKey=%s count=%d keys=%s".formatted(entry.getKey(), entry.getValue(), keys));
            }
        }
    }

    private void checkDragonEggObjective(AntiCheatCheckContext context) {
        DragonEggObservation observation = observeDragonEgg(context);
        DragonEggUiState uiState = dragonEggBeaconEffectHandler.currentUiState();

        if (observation.carriers() > 1) {
            alert(context, AntiCheatCategory.DRAGON_EGG, AntiCheatSeverity.CRITICAL, "lifesteal_dragon_egg_multiple_carriers", "Multiple Dragon Egg carriers detected",
                    "carriers=%d carrierNames=%s".formatted(observation.carriers(), observation.carrierNames()));
        }

        if (observation.visibleCount() > 1) {
            alert(context, AntiCheatCategory.DRAGON_EGG, AntiCheatSeverity.CRITICAL, "lifesteal_dragon_egg_visible_duplicate", "Possible loaded Dragon Egg duplication detected",
                    "visibleCount=%d carriers=%d dropped=%d framed=%d uiKind=%s uiWorld=%s uiPos=%d,%d,%d".formatted(
                            observation.visibleCount(),
                            observation.carriers(),
                            observation.dropped(),
                            observation.framed(),
                            uiState.kind(),
                            uiState.world(),
                            uiState.x(),
                            uiState.y(),
                            uiState.z()
                    ));
        }

        if (uiState.kind() == DragonEggLocationKind.CARRIED && observation.carriers() == 0) {
            alert(context, AntiCheatCategory.DRAGON_EGG, AntiCheatSeverity.HIGH, "lifesteal_dragon_egg_ui_carrier_missing", "Dragon Egg UI says carried but no carrier is visible",
                    "uiWorld=%s uiPos=%d,%d,%d visibleCount=%d".formatted(uiState.world(), uiState.x(), uiState.y(), uiState.z(), observation.visibleCount()));
        }

        if (uiState.kind() == DragonEggLocationKind.ABSENT && observation.visibleCount() > 0) {
            alert(context, AntiCheatCategory.DRAGON_EGG, AntiCheatSeverity.HIGH, "lifesteal_dragon_egg_ui_absent_mismatch", "Dragon Egg UI says absent but loaded egg state exists",
                    "visibleCount=%d carriers=%d dropped=%d framed=%d carrierNames=%s".formatted(
                            observation.visibleCount(),
                            observation.carriers(),
                            observation.dropped(),
                            observation.framed(),
                            observation.carrierNames()
                    ));
        }
    }

    private DragonEggObservation observeDragonEgg(AntiCheatCheckContext context) {
        int carriers = 0;
        int dropped = 0;
        int framed = 0;
        StringBuilder carrierNames = new StringBuilder();
        for (ServerPlayerEntity player : context.server().getPlayerManager().getPlayerList()) {
            int carried = 0;
            for (int slot = 0; slot < player.getInventory().size(); slot++) {
                carried += countItem(player.getInventory().getStack(slot), Items.DRAGON_EGG);
            }
            carried += countItem(player.currentScreenHandler.getCursorStack(), Items.DRAGON_EGG);
            if (carried > 0) {
                carriers++;
                if (!carrierNames.isEmpty()) {
                    carrierNames.append(",");
                }
                carrierNames.append(player.getName().getString()).append(":").append(carried);
            }
        }

        for (ServerWorld world : context.server().getWorlds()) {
            for (ItemEntity itemEntity : world.getEntitiesByType(TypeFilter.instanceOf(ItemEntity.class), entity -> entity.getStack().isOf(Items.DRAGON_EGG))) {
                dropped += itemEntity.getStack().getCount();
            }
            for (ItemFrameEntity itemFrame : world.getEntitiesByType(TypeFilter.instanceOf(ItemFrameEntity.class), entity -> entity.getHeldItemStack().isOf(Items.DRAGON_EGG))) {
                framed += Math.max(1, itemFrame.getHeldItemStack().getCount());
            }
        }

        return new DragonEggObservation(carriers, dropped, framed, carrierNames.toString());
    }

    private boolean isFirstOnlinePlayer(AntiCheatCheckContext context) {
        return !context.server().getPlayerManager().getPlayerList().isEmpty()
                && context.server().getPlayerManager().getPlayerList().get(0).getUuid().equals(context.player().getUuid());
    }

    private record DragonEggObservation(int carriers, int dropped, int framed, String carrierNames) {
        private int visibleCount() {
            return carriers + dropped + framed;
        }
    }

    private void alert(
            AntiCheatCheckContext context,
            AntiCheatCategory category,
            AntiCheatSeverity severity,
            String reasonCode,
            String publicReason,
            String detail
    ) {
        String alertKey = context.player().getUuid() + "|" + reasonCode;
        long lastAlertTick = lastAlertTicks.getOrDefault(alertKey, Long.MIN_VALUE);
        if (context.tick() - lastAlertTick < context.settings().lifestealAlertCooldownTicks()) {
            return;
        }
        lastAlertTicks.put(alertKey, context.tick());

        context.antiCheatService().handle(context.server(), context.player(), new AntiCheatDetection(
                category,
                severity,
                reasonCode,
                publicReason,
                "check=%s %s".formatted(id(), detail),
                AntiCheatAction.AUDIT_ONLY
        ));
    }
}
