package com.shd.lifesteal.impl.anticheat;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

public final class AntiCheatSettings {
    private static final String ENABLED = "enabled";
    private static final String DEFAULT_ACTION = "defaultAction";
    private static final String TEMP_BAN_MINUTES = "tempBanMinutes";
    private static final String APPEAL_URL = "appealUrl";
    private static final String MAX_HISTORY_ENTRIES = "maxHistoryEntries";
    private static final String OP_CHAT_ALERTS_ENABLED = "opChatAlerts.enabled";
    private static final String OP_CHAT_ALERTS_MIN_SEVERITY = "opChatAlerts.minSeverity";
    private static final String MOVEMENT_CHECKS_ENABLED = "movement.enabled";
    private static final String MOVEMENT_MAX_HORIZONTAL_PER_TICK = "movement.maxHorizontalPerTick";
    private static final String MOVEMENT_MAX_VERTICAL_PER_TICK = "movement.maxVerticalPerTick";
    private static final String MOVEMENT_TELEPORT_RESET_DISTANCE = "movement.teleportResetDistance";
    private static final String MOVEMENT_MAX_SUSTAINED_HORIZONTAL_PER_TICK = "movement.maxSustainedHorizontalPerTick";
    private static final String MOVEMENT_MAX_AIR_HORIZONTAL_PER_TICK = "movement.maxAirHorizontalPerTick";
    private static final String MOVEMENT_MAX_VERTICAL_BURST_PER_TICK = "movement.maxVerticalBurstPerTick";
    private static final String MOVEMENT_SPEED_BUFFER_TICKS = "movement.speedBufferTicks";
    private static final String MOVEMENT_AIR_SPEED_BUFFER_TICKS = "movement.airSpeedBufferTicks";
    private static final String MOVEMENT_HOVER_TICKS = "movement.hoverTicks";
    private static final String MOVEMENT_HOVER_VERTICAL_PER_TICK = "movement.hoverVerticalPerTick";
    private static final String MOVEMENT_FLY_UPWARD_TICKS = "movement.flyUpwardTicks";
    private static final String MOVEMENT_FLY_UPWARD_PER_TICK = "movement.flyUpwardPerTick";
    private static final String MOVEMENT_NO_FALL_MIN_DISTANCE = "movement.noFallMinDistance";
    private static final String MOVEMENT_NO_FALL_MIN_AIR_TICKS = "movement.noFallMinAirTicks";
    private static final String MOVEMENT_WATER_WALK_TICKS = "movement.waterWalkTicks";
    private static final String MOVEMENT_WATER_WALK_MIN_HORIZONTAL_PER_TICK = "movement.waterWalkMinHorizontalPerTick";
    private static final String MOVEMENT_CLIP_TICKS = "movement.clipTicks";
    private static final String MOVEMENT_ALERT_COOLDOWN_TICKS = "movement.alertCooldownTicks";
    private static final String COMBAT_CHECKS_ENABLED = "combat.enabled";
    private static final String COMBAT_MAX_REACH_BLOCKS = "combat.maxReachBlocks";
    private static final String COMBAT_MAX_VERTICAL_REACH_BLOCKS = "combat.maxVerticalReachBlocks";
    private static final String COMBAT_MIN_ATTACK_INTERVAL_TICKS = "combat.minAttackIntervalTicks";
    private static final String COMBAT_RAPID_ATTACK_BUFFER = "combat.rapidAttackBuffer";
    private static final String COMBAT_LOW_COOLDOWN_THRESHOLD = "combat.lowCooldownThreshold";
    private static final String COMBAT_LOW_COOLDOWN_BUFFER = "combat.lowCooldownBuffer";
    private static final String COMBAT_MULTI_TARGET_WINDOW_TICKS = "combat.multiTargetWindowTicks";
    private static final String COMBAT_MAX_TARGETS_PER_WINDOW = "combat.maxTargetsPerWindow";
    private static final String COMBAT_TARGET_SWITCH_BUFFER = "combat.targetSwitchBuffer";
    private static final String COMBAT_LINE_OF_SIGHT_BUFFER = "combat.lineOfSightBuffer";
    private static final String COMBAT_MENU_ATTACK_BUFFER = "combat.menuAttackBuffer";
    private static final String COMBAT_USING_ITEM_ATTACK_BUFFER = "combat.usingItemAttackBuffer";
    private static final String COMBAT_CRITICAL_BUFFER = "combat.criticalBuffer";
    private static final String COMBAT_CRITICAL_MIN_FALL_DISTANCE = "combat.criticalMinFallDistance";
    private static final String COMBAT_MAX_DAMAGE_TAKEN = "combat.maxDamageTaken";
    private static final String COMBAT_DAMAGE_SPIKE_BUFFER = "combat.damageSpikeBuffer";
    private static final String COMBAT_ALERT_COOLDOWN_TICKS = "combat.alertCooldownTicks";
    private static final String INVENTORY_CHECKS_ENABLED = "inventory.enabled";
    private static final String INVENTORY_SCAN_INTERVAL_TICKS = "inventory.scanIntervalTicks";
    private static final String INVENTORY_MAX_ALLOWED_STACK_SIZE = "inventory.maxAllowedStackSize";
    private static final String INVENTORY_MAX_ALLOWED_DAMAGE = "inventory.maxAllowedDamage";
    private static final String INVENTORY_MAX_ITEM_NAME_LENGTH = "inventory.maxItemNameLength";
    private static final String INVENTORY_ENCHANTMENT_LEVEL_TOLERANCE = "inventory.enchantmentLevelTolerance";
    private static final String INVENTORY_TRACK_ITEM_DELTAS = "inventory.trackItemDeltas";
    private static final String INVENTORY_MAX_SINGLE_SCAN_ITEM_GAIN = "inventory.maxSingleScanItemGain";
    private static final String INVENTORY_ALERT_COOLDOWN_TICKS = "inventory.alertCooldownTicks";
    private static final String INTERACTION_CHECKS_ENABLED = "interaction.enabled";
    private static final String INTERACTION_MAX_BLOCK_REACH = "interaction.maxBlockReach";
    private static final String INTERACTION_MAX_ENTITY_REACH = "interaction.maxEntityReach";
    private static final String INTERACTION_MIN_INTERVAL_TICKS = "interaction.minIntervalTicks";
    private static final String INTERACTION_RAPID_BUFFER = "interaction.rapidBuffer";
    private static final String INTERACTION_MENU_BUFFER = "interaction.menuBuffer";
    private static final String INTERACTION_SPECTATOR_BUFFER = "interaction.spectatorBuffer";
    private static final String INTERACTION_ALERT_COOLDOWN_TICKS = "interaction.alertCooldownTicks";
    private static final String ACCOUNT_CHECKS_ENABLED = "account.enabled";
    private static final String ACCOUNT_ALERT_NAME_CHANGES = "account.alertNameChanges";
    private static final String ACCOUNT_ALERT_NAME_REUSE = "account.alertNameReuse";
    private static final String ACCOUNT_ALERT_IP_CLUSTERS = "account.alertIpClusters";
    private static final String ACCOUNT_MAX_ACCOUNTS_PER_IP_HASH = "account.maxAccountsPerIpHash";
    private static final String ACCOUNT_ALERT_STAFF_LOGIN = "account.alertStaffLogin";
    private static final String CLIENT_CHECKS_ENABLED = "client.enabled";
    private static final String CLIENT_REQUIRE_BRAND = "client.requireBrand";
    private static final String CLIENT_BRAND_GRACE_TICKS = "client.brandGraceTicks";
    private static final String CLIENT_TRACK_BRAND_CHANGES = "client.trackBrandChanges";
    private static final String CLIENT_ALLOWED_BRANDS = "client.allowedBrands";
    private static final String CLIENT_BLOCKED_BRANDS = "client.blockedBrands";
    private static final String CLIENT_REQUIRED_CHANNELS = "client.requiredChannels";
    private static final String CLIENT_DISALLOWED_CHANNELS = "client.disallowedChannels";
    private static final String CLIENT_REQUIRE_MOD_REPORT = "client.requireModReport";
    private static final String CLIENT_SUSPICIOUS_MOD_IDS = "client.suspiciousModIds";
    private static final String CLIENT_BLOCKED_MOD_IDS = "client.blockedModIds";
    private static final String LIFESTEAL_CHECKS_ENABLED = "lifesteal.enabled";
    private static final String LIFESTEAL_SCAN_INTERVAL_TICKS = "lifesteal.scanIntervalTicks";
    private static final String LIFESTEAL_ALERT_COOLDOWN_TICKS = "lifesteal.alertCooldownTicks";
    private static final String LIFESTEAL_END_ACCESS_REQUIRES_EVENT = "lifesteal.endAccessRequiresEvent";
    private static final String LIFESTEAL_END_EVENT_NAME_MARKER = "lifesteal.endEventNameMarker";
    private static final String CATEGORY_PREFIX = "category.";

    private final Path path;
    private final Map<AntiCheatCategory, AntiCheatAction> categoryActions = new EnumMap<>(AntiCheatCategory.class);
    private boolean enabled = true;
    private AntiCheatAction defaultAction = AntiCheatAction.AUDIT_ONLY;
    private Duration tempBanDuration = Duration.ofDays(7);
    private String appealUrl = "https://shd.gg/appeal";
    private int maxHistoryEntries = 250;
    private boolean opChatAlertsEnabled = true;
    private AntiCheatSeverity opChatAlertsMinSeverity = AntiCheatSeverity.WARNING;
    private boolean movementChecksEnabled = true;
    private double movementMaxHorizontalPerTick = 16.0D;
    private double movementMaxVerticalPerTick = 8.0D;
    private double movementTeleportResetDistance = 24.0D;
    private double movementMaxSustainedHorizontalPerTick = 1.35D;
    private double movementMaxAirHorizontalPerTick = 1.45D;
    private double movementMaxVerticalBurstPerTick = 1.75D;
    private int movementSpeedBufferTicks = 6;
    private int movementAirSpeedBufferTicks = 6;
    private int movementHoverTicks = 25;
    private double movementHoverVerticalPerTick = 0.03D;
    private int movementFlyUpwardTicks = 12;
    private double movementFlyUpwardPerTick = 0.12D;
    private double movementNoFallMinDistance = 4.0D;
    private int movementNoFallMinAirTicks = 10;
    private int movementWaterWalkTicks = 12;
    private double movementWaterWalkMinHorizontalPerTick = 0.12D;
    private int movementClipTicks = 8;
    private int movementAlertCooldownTicks = 100;
    private boolean combatChecksEnabled = true;
    private double combatMaxReachBlocks = 6.0D;
    private double combatMaxVerticalReachBlocks = 4.5D;
    private int combatMinAttackIntervalTicks = 2;
    private int combatRapidAttackBuffer = 3;
    private double combatLowCooldownThreshold = 0.65D;
    private int combatLowCooldownBuffer = 5;
    private int combatMultiTargetWindowTicks = 5;
    private int combatMaxTargetsPerWindow = 3;
    private int combatTargetSwitchBuffer = 5;
    private int combatLineOfSightBuffer = 3;
    private int combatMenuAttackBuffer = 2;
    private int combatUsingItemAttackBuffer = 4;
    private int combatCriticalBuffer = 3;
    private double combatCriticalMinFallDistance = 0.08D;
    private double combatMaxDamageTaken = 45.0D;
    private int combatDamageSpikeBuffer = 2;
    private int combatAlertCooldownTicks = 100;
    private boolean inventoryChecksEnabled = true;
    private int inventoryScanIntervalTicks = 20;
    private int inventoryMaxAllowedStackSize = 99;
    private int inventoryMaxAllowedDamage = 4096;
    private int inventoryMaxItemNameLength = 96;
    private int inventoryEnchantmentLevelTolerance = 0;
    private boolean inventoryTrackItemDeltas = true;
    private int inventoryMaxSingleScanItemGain = 256;
    private int inventoryAlertCooldownTicks = 200;
    private boolean interactionChecksEnabled = true;
    private double interactionMaxBlockReach = 6.5D;
    private double interactionMaxEntityReach = 6.5D;
    private int interactionMinIntervalTicks = 1;
    private int interactionRapidBuffer = 8;
    private int interactionMenuBuffer = 2;
    private int interactionSpectatorBuffer = 1;
    private int interactionAlertCooldownTicks = 100;
    private boolean accountChecksEnabled = true;
    private boolean accountAlertNameChanges = true;
    private boolean accountAlertNameReuse = true;
    private boolean accountAlertIpClusters = true;
    private int accountMaxAccountsPerIpHash = 3;
    private boolean accountAlertStaffLogin = true;
    private boolean clientChecksEnabled = true;
    private boolean clientRequireBrand = true;
    private int clientBrandGraceTicks = 100;
    private boolean clientTrackBrandChanges = true;
    private Set<String> clientAllowedBrands = Set.of();
    private Set<String> clientBlockedBrands = Set.of();
    private Set<String> clientRequiredChannels = Set.of("shd-lifesteal-client:integrity");
    private Set<String> clientDisallowedChannels = Set.of();
    private boolean clientRequireModReport = true;
    private Set<String> clientSuspiciousModIds = Set.of(
            "xaerominimap",
            "xaeroworldmap",
            "journeymap",
            "voxelmap",
            "freecam",
            "baritone"
    );
    private Set<String> clientBlockedModIds = Set.of(
            "advanced-xray",
            "xray",
            "meteor-client",
            "wurst"
    );
    private boolean lifestealChecksEnabled = true;
    private int lifestealScanIntervalTicks = 20;
    private int lifestealAlertCooldownTicks = 200;
    private boolean lifestealEndAccessRequiresEvent = false;
    private String lifestealEndEventNameMarker = "end";

    public AntiCheatSettings(Path path) {
        this.path = path;
    }

    public void load() {
        Properties properties = new Properties();
        if (Files.exists(path)) {
            try (InputStream input = Files.newInputStream(path)) {
                properties.load(input);
            } catch (IOException ignored) {
                save();
                return;
            }
        }

        enabled = booleanProperty(properties, ENABLED, enabled);
        defaultAction = AntiCheatAction.parse(properties.getProperty(DEFAULT_ACTION), defaultAction);
        tempBanDuration = Duration.ofMinutes(longProperty(properties, TEMP_BAN_MINUTES, tempBanDuration.toMinutes()));
        appealUrl = stringProperty(properties, APPEAL_URL, appealUrl);
        maxHistoryEntries = intProperty(properties, MAX_HISTORY_ENTRIES, maxHistoryEntries);
        opChatAlertsEnabled = booleanProperty(properties, OP_CHAT_ALERTS_ENABLED, opChatAlertsEnabled);
        opChatAlertsMinSeverity = AntiCheatSeverity.parse(properties.getProperty(OP_CHAT_ALERTS_MIN_SEVERITY), opChatAlertsMinSeverity);
        movementChecksEnabled = booleanProperty(properties, MOVEMENT_CHECKS_ENABLED, movementChecksEnabled);
        movementMaxHorizontalPerTick = doubleProperty(properties, MOVEMENT_MAX_HORIZONTAL_PER_TICK, movementMaxHorizontalPerTick);
        movementMaxVerticalPerTick = doubleProperty(properties, MOVEMENT_MAX_VERTICAL_PER_TICK, movementMaxVerticalPerTick);
        movementTeleportResetDistance = doubleProperty(properties, MOVEMENT_TELEPORT_RESET_DISTANCE, movementTeleportResetDistance);
        movementMaxSustainedHorizontalPerTick = doubleProperty(properties, MOVEMENT_MAX_SUSTAINED_HORIZONTAL_PER_TICK, movementMaxSustainedHorizontalPerTick);
        movementMaxAirHorizontalPerTick = doubleProperty(properties, MOVEMENT_MAX_AIR_HORIZONTAL_PER_TICK, movementMaxAirHorizontalPerTick);
        movementMaxVerticalBurstPerTick = doubleProperty(properties, MOVEMENT_MAX_VERTICAL_BURST_PER_TICK, movementMaxVerticalBurstPerTick);
        movementSpeedBufferTicks = intProperty(properties, MOVEMENT_SPEED_BUFFER_TICKS, movementSpeedBufferTicks);
        movementAirSpeedBufferTicks = intProperty(properties, MOVEMENT_AIR_SPEED_BUFFER_TICKS, movementAirSpeedBufferTicks);
        movementHoverTicks = intProperty(properties, MOVEMENT_HOVER_TICKS, movementHoverTicks);
        movementHoverVerticalPerTick = doubleProperty(properties, MOVEMENT_HOVER_VERTICAL_PER_TICK, movementHoverVerticalPerTick);
        movementFlyUpwardTicks = intProperty(properties, MOVEMENT_FLY_UPWARD_TICKS, movementFlyUpwardTicks);
        movementFlyUpwardPerTick = doubleProperty(properties, MOVEMENT_FLY_UPWARD_PER_TICK, movementFlyUpwardPerTick);
        movementNoFallMinDistance = doubleProperty(properties, MOVEMENT_NO_FALL_MIN_DISTANCE, movementNoFallMinDistance);
        movementNoFallMinAirTicks = intProperty(properties, MOVEMENT_NO_FALL_MIN_AIR_TICKS, movementNoFallMinAirTicks);
        movementWaterWalkTicks = intProperty(properties, MOVEMENT_WATER_WALK_TICKS, movementWaterWalkTicks);
        movementWaterWalkMinHorizontalPerTick = doubleProperty(properties, MOVEMENT_WATER_WALK_MIN_HORIZONTAL_PER_TICK, movementWaterWalkMinHorizontalPerTick);
        movementClipTicks = intProperty(properties, MOVEMENT_CLIP_TICKS, movementClipTicks);
        movementAlertCooldownTicks = intProperty(properties, MOVEMENT_ALERT_COOLDOWN_TICKS, movementAlertCooldownTicks);
        combatChecksEnabled = booleanProperty(properties, COMBAT_CHECKS_ENABLED, combatChecksEnabled);
        combatMaxReachBlocks = doubleProperty(properties, COMBAT_MAX_REACH_BLOCKS, combatMaxReachBlocks);
        combatMaxVerticalReachBlocks = doubleProperty(properties, COMBAT_MAX_VERTICAL_REACH_BLOCKS, combatMaxVerticalReachBlocks);
        combatMinAttackIntervalTicks = intProperty(properties, COMBAT_MIN_ATTACK_INTERVAL_TICKS, combatMinAttackIntervalTicks);
        combatRapidAttackBuffer = intProperty(properties, COMBAT_RAPID_ATTACK_BUFFER, combatRapidAttackBuffer);
        combatLowCooldownThreshold = doubleProperty(properties, COMBAT_LOW_COOLDOWN_THRESHOLD, combatLowCooldownThreshold);
        combatLowCooldownBuffer = intProperty(properties, COMBAT_LOW_COOLDOWN_BUFFER, combatLowCooldownBuffer);
        combatMultiTargetWindowTicks = intProperty(properties, COMBAT_MULTI_TARGET_WINDOW_TICKS, combatMultiTargetWindowTicks);
        combatMaxTargetsPerWindow = intProperty(properties, COMBAT_MAX_TARGETS_PER_WINDOW, combatMaxTargetsPerWindow);
        combatTargetSwitchBuffer = intProperty(properties, COMBAT_TARGET_SWITCH_BUFFER, combatTargetSwitchBuffer);
        combatLineOfSightBuffer = intProperty(properties, COMBAT_LINE_OF_SIGHT_BUFFER, combatLineOfSightBuffer);
        combatMenuAttackBuffer = intProperty(properties, COMBAT_MENU_ATTACK_BUFFER, combatMenuAttackBuffer);
        combatUsingItemAttackBuffer = intProperty(properties, COMBAT_USING_ITEM_ATTACK_BUFFER, combatUsingItemAttackBuffer);
        combatCriticalBuffer = intProperty(properties, COMBAT_CRITICAL_BUFFER, combatCriticalBuffer);
        combatCriticalMinFallDistance = doubleProperty(properties, COMBAT_CRITICAL_MIN_FALL_DISTANCE, combatCriticalMinFallDistance);
        combatMaxDamageTaken = doubleProperty(properties, COMBAT_MAX_DAMAGE_TAKEN, combatMaxDamageTaken);
        combatDamageSpikeBuffer = intProperty(properties, COMBAT_DAMAGE_SPIKE_BUFFER, combatDamageSpikeBuffer);
        combatAlertCooldownTicks = intProperty(properties, COMBAT_ALERT_COOLDOWN_TICKS, combatAlertCooldownTicks);
        inventoryChecksEnabled = booleanProperty(properties, INVENTORY_CHECKS_ENABLED, inventoryChecksEnabled);
        inventoryScanIntervalTicks = intProperty(properties, INVENTORY_SCAN_INTERVAL_TICKS, inventoryScanIntervalTicks);
        inventoryMaxAllowedStackSize = intProperty(properties, INVENTORY_MAX_ALLOWED_STACK_SIZE, inventoryMaxAllowedStackSize);
        inventoryMaxAllowedDamage = intProperty(properties, INVENTORY_MAX_ALLOWED_DAMAGE, inventoryMaxAllowedDamage);
        inventoryMaxItemNameLength = intProperty(properties, INVENTORY_MAX_ITEM_NAME_LENGTH, inventoryMaxItemNameLength);
        inventoryEnchantmentLevelTolerance = nonNegativeIntProperty(properties, INVENTORY_ENCHANTMENT_LEVEL_TOLERANCE, inventoryEnchantmentLevelTolerance);
        inventoryTrackItemDeltas = booleanProperty(properties, INVENTORY_TRACK_ITEM_DELTAS, inventoryTrackItemDeltas);
        inventoryMaxSingleScanItemGain = intProperty(properties, INVENTORY_MAX_SINGLE_SCAN_ITEM_GAIN, inventoryMaxSingleScanItemGain);
        inventoryAlertCooldownTicks = intProperty(properties, INVENTORY_ALERT_COOLDOWN_TICKS, inventoryAlertCooldownTicks);
        interactionChecksEnabled = booleanProperty(properties, INTERACTION_CHECKS_ENABLED, interactionChecksEnabled);
        interactionMaxBlockReach = doubleProperty(properties, INTERACTION_MAX_BLOCK_REACH, interactionMaxBlockReach);
        interactionMaxEntityReach = doubleProperty(properties, INTERACTION_MAX_ENTITY_REACH, interactionMaxEntityReach);
        interactionMinIntervalTicks = intProperty(properties, INTERACTION_MIN_INTERVAL_TICKS, interactionMinIntervalTicks);
        interactionRapidBuffer = intProperty(properties, INTERACTION_RAPID_BUFFER, interactionRapidBuffer);
        interactionMenuBuffer = intProperty(properties, INTERACTION_MENU_BUFFER, interactionMenuBuffer);
        interactionSpectatorBuffer = intProperty(properties, INTERACTION_SPECTATOR_BUFFER, interactionSpectatorBuffer);
        interactionAlertCooldownTicks = intProperty(properties, INTERACTION_ALERT_COOLDOWN_TICKS, interactionAlertCooldownTicks);
        accountChecksEnabled = booleanProperty(properties, ACCOUNT_CHECKS_ENABLED, accountChecksEnabled);
        accountAlertNameChanges = booleanProperty(properties, ACCOUNT_ALERT_NAME_CHANGES, accountAlertNameChanges);
        accountAlertNameReuse = booleanProperty(properties, ACCOUNT_ALERT_NAME_REUSE, accountAlertNameReuse);
        accountAlertIpClusters = booleanProperty(properties, ACCOUNT_ALERT_IP_CLUSTERS, accountAlertIpClusters);
        accountMaxAccountsPerIpHash = intProperty(properties, ACCOUNT_MAX_ACCOUNTS_PER_IP_HASH, accountMaxAccountsPerIpHash);
        accountAlertStaffLogin = booleanProperty(properties, ACCOUNT_ALERT_STAFF_LOGIN, accountAlertStaffLogin);
        clientChecksEnabled = booleanProperty(properties, CLIENT_CHECKS_ENABLED, clientChecksEnabled);
        clientRequireBrand = booleanProperty(properties, CLIENT_REQUIRE_BRAND, clientRequireBrand);
        clientBrandGraceTicks = intProperty(properties, CLIENT_BRAND_GRACE_TICKS, clientBrandGraceTicks);
        clientTrackBrandChanges = booleanProperty(properties, CLIENT_TRACK_BRAND_CHANGES, clientTrackBrandChanges);
        clientAllowedBrands = setProperty(properties, CLIENT_ALLOWED_BRANDS, clientAllowedBrands);
        clientBlockedBrands = setProperty(properties, CLIENT_BLOCKED_BRANDS, clientBlockedBrands);
        clientRequiredChannels = setProperty(properties, CLIENT_REQUIRED_CHANNELS, clientRequiredChannels);
        clientDisallowedChannels = setProperty(properties, CLIENT_DISALLOWED_CHANNELS, clientDisallowedChannels);
        clientRequireModReport = booleanProperty(properties, CLIENT_REQUIRE_MOD_REPORT, clientRequireModReport);
        clientSuspiciousModIds = setProperty(properties, CLIENT_SUSPICIOUS_MOD_IDS, clientSuspiciousModIds);
        clientBlockedModIds = setProperty(properties, CLIENT_BLOCKED_MOD_IDS, clientBlockedModIds);
        lifestealChecksEnabled = booleanProperty(properties, LIFESTEAL_CHECKS_ENABLED, lifestealChecksEnabled);
        lifestealScanIntervalTicks = intProperty(properties, LIFESTEAL_SCAN_INTERVAL_TICKS, lifestealScanIntervalTicks);
        lifestealAlertCooldownTicks = intProperty(properties, LIFESTEAL_ALERT_COOLDOWN_TICKS, lifestealAlertCooldownTicks);
        lifestealEndAccessRequiresEvent = booleanProperty(properties, LIFESTEAL_END_ACCESS_REQUIRES_EVENT, lifestealEndAccessRequiresEvent);
        lifestealEndEventNameMarker = stringProperty(properties, LIFESTEAL_END_EVENT_NAME_MARKER, lifestealEndEventNameMarker).toLowerCase(java.util.Locale.ROOT);

        categoryActions.clear();
        for (AntiCheatCategory category : AntiCheatCategory.values()) {
            String key = CATEGORY_PREFIX + category.name().toLowerCase();
            AntiCheatAction action = AntiCheatAction.parse(properties.getProperty(key), null);
            if (action != null) {
                categoryActions.put(category, action);
            }
        }

        save();
    }

    public boolean enabled() {
        return enabled;
    }

    public AntiCheatAction actionFor(AntiCheatDetection detection) {
        AntiCheatAction configured = categoryActions.get(detection.category());
        if (configured != null) {
            return configured;
        }
        if (detection.recommendedAction() != null) {
            return detection.recommendedAction();
        }
        return defaultAction;
    }

    public Duration tempBanDuration() {
        return tempBanDuration;
    }

    public String appealUrl() {
        return appealUrl;
    }

    public int maxHistoryEntries() {
        return maxHistoryEntries;
    }

    public boolean opChatAlertsEnabled() {
        return opChatAlertsEnabled;
    }

    public AntiCheatSeverity opChatAlertsMinSeverity() {
        return opChatAlertsMinSeverity;
    }

    public boolean movementChecksEnabled() {
        return movementChecksEnabled;
    }

    public double movementMaxHorizontalPerTick() {
        return movementMaxHorizontalPerTick;
    }

    public double movementMaxVerticalPerTick() {
        return movementMaxVerticalPerTick;
    }

    public double movementTeleportResetDistance() {
        return movementTeleportResetDistance;
    }

    public double movementMaxSustainedHorizontalPerTick() {
        return movementMaxSustainedHorizontalPerTick;
    }

    public double movementMaxAirHorizontalPerTick() {
        return movementMaxAirHorizontalPerTick;
    }

    public double movementMaxVerticalBurstPerTick() {
        return movementMaxVerticalBurstPerTick;
    }

    public int movementSpeedBufferTicks() {
        return movementSpeedBufferTicks;
    }

    public int movementAirSpeedBufferTicks() {
        return movementAirSpeedBufferTicks;
    }

    public int movementHoverTicks() {
        return movementHoverTicks;
    }

    public double movementHoverVerticalPerTick() {
        return movementHoverVerticalPerTick;
    }

    public int movementFlyUpwardTicks() {
        return movementFlyUpwardTicks;
    }

    public double movementFlyUpwardPerTick() {
        return movementFlyUpwardPerTick;
    }

    public double movementNoFallMinDistance() {
        return movementNoFallMinDistance;
    }

    public int movementNoFallMinAirTicks() {
        return movementNoFallMinAirTicks;
    }

    public int movementWaterWalkTicks() {
        return movementWaterWalkTicks;
    }

    public double movementWaterWalkMinHorizontalPerTick() {
        return movementWaterWalkMinHorizontalPerTick;
    }

    public int movementClipTicks() {
        return movementClipTicks;
    }

    public int movementAlertCooldownTicks() {
        return movementAlertCooldownTicks;
    }

    public boolean combatChecksEnabled() {
        return combatChecksEnabled;
    }

    public double combatMaxReachBlocks() {
        return combatMaxReachBlocks;
    }

    public double combatMaxVerticalReachBlocks() {
        return combatMaxVerticalReachBlocks;
    }

    public int combatMinAttackIntervalTicks() {
        return combatMinAttackIntervalTicks;
    }

    public int combatRapidAttackBuffer() {
        return combatRapidAttackBuffer;
    }

    public double combatLowCooldownThreshold() {
        return combatLowCooldownThreshold;
    }

    public int combatLowCooldownBuffer() {
        return combatLowCooldownBuffer;
    }

    public int combatMultiTargetWindowTicks() {
        return combatMultiTargetWindowTicks;
    }

    public int combatMaxTargetsPerWindow() {
        return combatMaxTargetsPerWindow;
    }

    public int combatTargetSwitchBuffer() {
        return combatTargetSwitchBuffer;
    }

    public int combatLineOfSightBuffer() {
        return combatLineOfSightBuffer;
    }

    public int combatMenuAttackBuffer() {
        return combatMenuAttackBuffer;
    }

    public int combatUsingItemAttackBuffer() {
        return combatUsingItemAttackBuffer;
    }

    public int combatCriticalBuffer() {
        return combatCriticalBuffer;
    }

    public double combatCriticalMinFallDistance() {
        return combatCriticalMinFallDistance;
    }

    public double combatMaxDamageTaken() {
        return combatMaxDamageTaken;
    }

    public int combatDamageSpikeBuffer() {
        return combatDamageSpikeBuffer;
    }

    public int combatAlertCooldownTicks() {
        return combatAlertCooldownTicks;
    }

    public boolean inventoryChecksEnabled() {
        return inventoryChecksEnabled;
    }

    public int inventoryScanIntervalTicks() {
        return inventoryScanIntervalTicks;
    }

    public int inventoryMaxAllowedStackSize() {
        return inventoryMaxAllowedStackSize;
    }

    public int inventoryMaxAllowedDamage() {
        return inventoryMaxAllowedDamage;
    }

    public int inventoryMaxItemNameLength() {
        return inventoryMaxItemNameLength;
    }

    public int inventoryEnchantmentLevelTolerance() {
        return inventoryEnchantmentLevelTolerance;
    }

    public boolean inventoryTrackItemDeltas() {
        return inventoryTrackItemDeltas;
    }

    public int inventoryMaxSingleScanItemGain() {
        return inventoryMaxSingleScanItemGain;
    }

    public int inventoryAlertCooldownTicks() {
        return inventoryAlertCooldownTicks;
    }

    public boolean interactionChecksEnabled() {
        return interactionChecksEnabled;
    }

    public double interactionMaxBlockReach() {
        return interactionMaxBlockReach;
    }

    public double interactionMaxEntityReach() {
        return interactionMaxEntityReach;
    }

    public int interactionMinIntervalTicks() {
        return interactionMinIntervalTicks;
    }

    public int interactionRapidBuffer() {
        return interactionRapidBuffer;
    }

    public int interactionMenuBuffer() {
        return interactionMenuBuffer;
    }

    public int interactionSpectatorBuffer() {
        return interactionSpectatorBuffer;
    }

    public int interactionAlertCooldownTicks() {
        return interactionAlertCooldownTicks;
    }

    public boolean accountChecksEnabled() {
        return accountChecksEnabled;
    }

    public boolean accountAlertNameChanges() {
        return accountAlertNameChanges;
    }

    public boolean accountAlertNameReuse() {
        return accountAlertNameReuse;
    }

    public boolean accountAlertIpClusters() {
        return accountAlertIpClusters;
    }

    public int accountMaxAccountsPerIpHash() {
        return accountMaxAccountsPerIpHash;
    }

    public boolean accountAlertStaffLogin() {
        return accountAlertStaffLogin;
    }

    public boolean clientChecksEnabled() {
        return clientChecksEnabled;
    }

    public boolean clientRequireBrand() {
        return clientRequireBrand;
    }

    public int clientBrandGraceTicks() {
        return clientBrandGraceTicks;
    }

    public boolean clientTrackBrandChanges() {
        return clientTrackBrandChanges;
    }

    public Set<String> clientAllowedBrands() {
        return clientAllowedBrands;
    }

    public Set<String> clientBlockedBrands() {
        return clientBlockedBrands;
    }

    public Set<String> clientRequiredChannels() {
        return clientRequiredChannels;
    }

    public Set<String> clientDisallowedChannels() {
        return clientDisallowedChannels;
    }

    public boolean clientRequireModReport() {
        return clientRequireModReport;
    }

    public Set<String> clientSuspiciousModIds() {
        return clientSuspiciousModIds;
    }

    public Set<String> clientBlockedModIds() {
        return clientBlockedModIds;
    }

    public boolean lifestealChecksEnabled() {
        return lifestealChecksEnabled;
    }

    public int lifestealScanIntervalTicks() {
        return lifestealScanIntervalTicks;
    }

    public int lifestealAlertCooldownTicks() {
        return lifestealAlertCooldownTicks;
    }

    public boolean lifestealEndAccessRequiresEvent() {
        return lifestealEndAccessRequiresEvent;
    }

    public String lifestealEndEventNameMarker() {
        return lifestealEndEventNameMarker;
    }

    public String statusText() {
        return "enabled=%s defaultAction=%s tempBanMinutes=%d appealUrl=%s history=%d opChat=%s/%s checks[movement=%s combat=%s inventory=%s interaction=%s account=%s client=%s lifesteal=%s] movement=burst%.1f/%.1f sustained%.2f air%.2f hover%d nofall%.1f waterWalk%d clip%d combat=reach%.1f/y%.1f/min%d/cd%.2f/multi%d:%d damage%.1f inventory=scan%d/maxStack%d/gain%d interaction=block%.1f/entity%.1f/min%d account=maxIp%d client=brand%s/requiredChannels%d/modReport%s/suspiciousMods%d/blockedMods%d lifestealScan=%d endGate=%s overrides=%d".formatted(
                enabled,
                defaultAction,
                tempBanDuration.toMinutes(),
                appealUrl,
                maxHistoryEntries,
                opChatAlertsEnabled,
                opChatAlertsMinSeverity,
                movementChecksEnabled,
                combatChecksEnabled,
                inventoryChecksEnabled,
                interactionChecksEnabled,
                accountChecksEnabled,
                clientChecksEnabled,
                lifestealChecksEnabled,
                movementMaxHorizontalPerTick,
                movementMaxVerticalPerTick,
                movementMaxSustainedHorizontalPerTick,
                movementMaxAirHorizontalPerTick,
                movementHoverTicks,
                movementNoFallMinDistance,
                movementWaterWalkTicks,
                movementClipTicks,
                combatMaxReachBlocks,
                combatMaxVerticalReachBlocks,
                combatMinAttackIntervalTicks,
                combatLowCooldownThreshold,
                combatMaxTargetsPerWindow,
                combatMultiTargetWindowTicks,
                combatMaxDamageTaken,
                inventoryScanIntervalTicks,
                inventoryMaxAllowedStackSize,
                inventoryMaxSingleScanItemGain,
                interactionMaxBlockReach,
                interactionMaxEntityReach,
                interactionMinIntervalTicks,
                accountMaxAccountsPerIpHash,
                clientRequireBrand ? "required" : "optional",
                clientRequiredChannels.size(),
                clientRequireModReport ? "required" : "optional",
                clientSuspiciousModIds.size(),
                clientBlockedModIds.size(),
                lifestealScanIntervalTicks,
                lifestealEndAccessRequiresEvent,
                categoryActions.size()
        );
    }

    private void save() {
        Properties properties = new Properties();
        properties.setProperty(ENABLED, Boolean.toString(enabled));
        properties.setProperty(DEFAULT_ACTION, defaultAction.name());
        properties.setProperty(TEMP_BAN_MINUTES, Long.toString(tempBanDuration.toMinutes()));
        properties.setProperty(APPEAL_URL, appealUrl);
        properties.setProperty(MAX_HISTORY_ENTRIES, Integer.toString(maxHistoryEntries));
        properties.setProperty(OP_CHAT_ALERTS_ENABLED, Boolean.toString(opChatAlertsEnabled));
        properties.setProperty(OP_CHAT_ALERTS_MIN_SEVERITY, opChatAlertsMinSeverity.name());
        properties.setProperty(MOVEMENT_CHECKS_ENABLED, Boolean.toString(movementChecksEnabled));
        properties.setProperty(MOVEMENT_MAX_HORIZONTAL_PER_TICK, Double.toString(movementMaxHorizontalPerTick));
        properties.setProperty(MOVEMENT_MAX_VERTICAL_PER_TICK, Double.toString(movementMaxVerticalPerTick));
        properties.setProperty(MOVEMENT_TELEPORT_RESET_DISTANCE, Double.toString(movementTeleportResetDistance));
        properties.setProperty(MOVEMENT_MAX_SUSTAINED_HORIZONTAL_PER_TICK, Double.toString(movementMaxSustainedHorizontalPerTick));
        properties.setProperty(MOVEMENT_MAX_AIR_HORIZONTAL_PER_TICK, Double.toString(movementMaxAirHorizontalPerTick));
        properties.setProperty(MOVEMENT_MAX_VERTICAL_BURST_PER_TICK, Double.toString(movementMaxVerticalBurstPerTick));
        properties.setProperty(MOVEMENT_SPEED_BUFFER_TICKS, Integer.toString(movementSpeedBufferTicks));
        properties.setProperty(MOVEMENT_AIR_SPEED_BUFFER_TICKS, Integer.toString(movementAirSpeedBufferTicks));
        properties.setProperty(MOVEMENT_HOVER_TICKS, Integer.toString(movementHoverTicks));
        properties.setProperty(MOVEMENT_HOVER_VERTICAL_PER_TICK, Double.toString(movementHoverVerticalPerTick));
        properties.setProperty(MOVEMENT_FLY_UPWARD_TICKS, Integer.toString(movementFlyUpwardTicks));
        properties.setProperty(MOVEMENT_FLY_UPWARD_PER_TICK, Double.toString(movementFlyUpwardPerTick));
        properties.setProperty(MOVEMENT_NO_FALL_MIN_DISTANCE, Double.toString(movementNoFallMinDistance));
        properties.setProperty(MOVEMENT_NO_FALL_MIN_AIR_TICKS, Integer.toString(movementNoFallMinAirTicks));
        properties.setProperty(MOVEMENT_WATER_WALK_TICKS, Integer.toString(movementWaterWalkTicks));
        properties.setProperty(MOVEMENT_WATER_WALK_MIN_HORIZONTAL_PER_TICK, Double.toString(movementWaterWalkMinHorizontalPerTick));
        properties.setProperty(MOVEMENT_CLIP_TICKS, Integer.toString(movementClipTicks));
        properties.setProperty(MOVEMENT_ALERT_COOLDOWN_TICKS, Integer.toString(movementAlertCooldownTicks));
        properties.setProperty(COMBAT_CHECKS_ENABLED, Boolean.toString(combatChecksEnabled));
        properties.setProperty(COMBAT_MAX_REACH_BLOCKS, Double.toString(combatMaxReachBlocks));
        properties.setProperty(COMBAT_MAX_VERTICAL_REACH_BLOCKS, Double.toString(combatMaxVerticalReachBlocks));
        properties.setProperty(COMBAT_MIN_ATTACK_INTERVAL_TICKS, Integer.toString(combatMinAttackIntervalTicks));
        properties.setProperty(COMBAT_RAPID_ATTACK_BUFFER, Integer.toString(combatRapidAttackBuffer));
        properties.setProperty(COMBAT_LOW_COOLDOWN_THRESHOLD, Double.toString(combatLowCooldownThreshold));
        properties.setProperty(COMBAT_LOW_COOLDOWN_BUFFER, Integer.toString(combatLowCooldownBuffer));
        properties.setProperty(COMBAT_MULTI_TARGET_WINDOW_TICKS, Integer.toString(combatMultiTargetWindowTicks));
        properties.setProperty(COMBAT_MAX_TARGETS_PER_WINDOW, Integer.toString(combatMaxTargetsPerWindow));
        properties.setProperty(COMBAT_TARGET_SWITCH_BUFFER, Integer.toString(combatTargetSwitchBuffer));
        properties.setProperty(COMBAT_LINE_OF_SIGHT_BUFFER, Integer.toString(combatLineOfSightBuffer));
        properties.setProperty(COMBAT_MENU_ATTACK_BUFFER, Integer.toString(combatMenuAttackBuffer));
        properties.setProperty(COMBAT_USING_ITEM_ATTACK_BUFFER, Integer.toString(combatUsingItemAttackBuffer));
        properties.setProperty(COMBAT_CRITICAL_BUFFER, Integer.toString(combatCriticalBuffer));
        properties.setProperty(COMBAT_CRITICAL_MIN_FALL_DISTANCE, Double.toString(combatCriticalMinFallDistance));
        properties.setProperty(COMBAT_MAX_DAMAGE_TAKEN, Double.toString(combatMaxDamageTaken));
        properties.setProperty(COMBAT_DAMAGE_SPIKE_BUFFER, Integer.toString(combatDamageSpikeBuffer));
        properties.setProperty(COMBAT_ALERT_COOLDOWN_TICKS, Integer.toString(combatAlertCooldownTicks));
        properties.setProperty(INVENTORY_CHECKS_ENABLED, Boolean.toString(inventoryChecksEnabled));
        properties.setProperty(INVENTORY_SCAN_INTERVAL_TICKS, Integer.toString(inventoryScanIntervalTicks));
        properties.setProperty(INVENTORY_MAX_ALLOWED_STACK_SIZE, Integer.toString(inventoryMaxAllowedStackSize));
        properties.setProperty(INVENTORY_MAX_ALLOWED_DAMAGE, Integer.toString(inventoryMaxAllowedDamage));
        properties.setProperty(INVENTORY_MAX_ITEM_NAME_LENGTH, Integer.toString(inventoryMaxItemNameLength));
        properties.setProperty(INVENTORY_ENCHANTMENT_LEVEL_TOLERANCE, Integer.toString(inventoryEnchantmentLevelTolerance));
        properties.setProperty(INVENTORY_TRACK_ITEM_DELTAS, Boolean.toString(inventoryTrackItemDeltas));
        properties.setProperty(INVENTORY_MAX_SINGLE_SCAN_ITEM_GAIN, Integer.toString(inventoryMaxSingleScanItemGain));
        properties.setProperty(INVENTORY_ALERT_COOLDOWN_TICKS, Integer.toString(inventoryAlertCooldownTicks));
        properties.setProperty(INTERACTION_CHECKS_ENABLED, Boolean.toString(interactionChecksEnabled));
        properties.setProperty(INTERACTION_MAX_BLOCK_REACH, Double.toString(interactionMaxBlockReach));
        properties.setProperty(INTERACTION_MAX_ENTITY_REACH, Double.toString(interactionMaxEntityReach));
        properties.setProperty(INTERACTION_MIN_INTERVAL_TICKS, Integer.toString(interactionMinIntervalTicks));
        properties.setProperty(INTERACTION_RAPID_BUFFER, Integer.toString(interactionRapidBuffer));
        properties.setProperty(INTERACTION_MENU_BUFFER, Integer.toString(interactionMenuBuffer));
        properties.setProperty(INTERACTION_SPECTATOR_BUFFER, Integer.toString(interactionSpectatorBuffer));
        properties.setProperty(INTERACTION_ALERT_COOLDOWN_TICKS, Integer.toString(interactionAlertCooldownTicks));
        properties.setProperty(ACCOUNT_CHECKS_ENABLED, Boolean.toString(accountChecksEnabled));
        properties.setProperty(ACCOUNT_ALERT_NAME_CHANGES, Boolean.toString(accountAlertNameChanges));
        properties.setProperty(ACCOUNT_ALERT_NAME_REUSE, Boolean.toString(accountAlertNameReuse));
        properties.setProperty(ACCOUNT_ALERT_IP_CLUSTERS, Boolean.toString(accountAlertIpClusters));
        properties.setProperty(ACCOUNT_MAX_ACCOUNTS_PER_IP_HASH, Integer.toString(accountMaxAccountsPerIpHash));
        properties.setProperty(ACCOUNT_ALERT_STAFF_LOGIN, Boolean.toString(accountAlertStaffLogin));
        properties.setProperty(CLIENT_CHECKS_ENABLED, Boolean.toString(clientChecksEnabled));
        properties.setProperty(CLIENT_REQUIRE_BRAND, Boolean.toString(clientRequireBrand));
        properties.setProperty(CLIENT_BRAND_GRACE_TICKS, Integer.toString(clientBrandGraceTicks));
        properties.setProperty(CLIENT_TRACK_BRAND_CHANGES, Boolean.toString(clientTrackBrandChanges));
        properties.setProperty(CLIENT_ALLOWED_BRANDS, joinSet(clientAllowedBrands));
        properties.setProperty(CLIENT_BLOCKED_BRANDS, joinSet(clientBlockedBrands));
        properties.setProperty(CLIENT_REQUIRED_CHANNELS, joinSet(clientRequiredChannels));
        properties.setProperty(CLIENT_DISALLOWED_CHANNELS, joinSet(clientDisallowedChannels));
        properties.setProperty(CLIENT_REQUIRE_MOD_REPORT, Boolean.toString(clientRequireModReport));
        properties.setProperty(CLIENT_SUSPICIOUS_MOD_IDS, joinSet(clientSuspiciousModIds));
        properties.setProperty(CLIENT_BLOCKED_MOD_IDS, joinSet(clientBlockedModIds));
        properties.setProperty(LIFESTEAL_CHECKS_ENABLED, Boolean.toString(lifestealChecksEnabled));
        properties.setProperty(LIFESTEAL_SCAN_INTERVAL_TICKS, Integer.toString(lifestealScanIntervalTicks));
        properties.setProperty(LIFESTEAL_ALERT_COOLDOWN_TICKS, Integer.toString(lifestealAlertCooldownTicks));
        properties.setProperty(LIFESTEAL_END_ACCESS_REQUIRES_EVENT, Boolean.toString(lifestealEndAccessRequiresEvent));
        properties.setProperty(LIFESTEAL_END_EVENT_NAME_MARKER, lifestealEndEventNameMarker);
        for (Map.Entry<AntiCheatCategory, AntiCheatAction> entry : categoryActions.entrySet()) {
            properties.setProperty(CATEGORY_PREFIX + entry.getKey().name().toLowerCase(), entry.getValue().name());
        }

        try {
            Files.createDirectories(path.getParent());
            try (OutputStream output = Files.newOutputStream(path)) {
                properties.store(output, "SHD anti-cheat settings");
            }
        } catch (IOException ignored) {
            // Anti-cheat settings should not prevent the server from starting.
        }
    }

    private static boolean booleanProperty(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        return value == null || value.isBlank() ? fallback : Boolean.parseBoolean(value);
    }

    private static long longProperty(Properties properties, String key, long fallback) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static int intProperty(Properties properties, String key, int fallback) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Math.max(1, Integer.parseInt(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static int nonNegativeIntProperty(Properties properties, String key, int fallback) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Math.max(0, Integer.parseInt(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static double doubleProperty(Properties properties, String key, double fallback) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Math.max(0.0D, Double.parseDouble(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static String stringProperty(Properties properties, String key, String fallback) {
        String value = properties.getProperty(key);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static Set<String> setProperty(Properties properties, String key, Set<String> fallback) {
        String value = properties.getProperty(key);
        if (value == null) {
            return fallback;
        }
        if (value.isBlank()) {
            return Set.of();
        }

        Set<String> values = new LinkedHashSet<>();
        for (String entry : value.split(",")) {
            String normalized = entry.trim().toLowerCase(java.util.Locale.ROOT);
            if (!normalized.isBlank()) {
                values.add(normalized);
            }
        }
        return Set.copyOf(values);
    }

    private static String joinSet(Set<String> values) {
        return String.join(",", values);
    }
}
