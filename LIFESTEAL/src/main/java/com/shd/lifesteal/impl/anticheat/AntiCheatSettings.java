package com.shd.lifesteal.impl.anticheat;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;
import java.util.Properties;

public final class AntiCheatSettings {
    private static final String ENABLED = "enabled";
    private static final String DEFAULT_ACTION = "defaultAction";
    private static final String TEMP_BAN_MINUTES = "tempBanMinutes";
    private static final String APPEAL_URL = "appealUrl";
    private static final String MAX_HISTORY_ENTRIES = "maxHistoryEntries";
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
    private static final String COMBAT_ALERT_COOLDOWN_TICKS = "combat.alertCooldownTicks";
    private static final String INVENTORY_CHECKS_ENABLED = "inventory.enabled";
    private static final String INVENTORY_SCAN_INTERVAL_TICKS = "inventory.scanIntervalTicks";
    private static final String INVENTORY_ALERT_COOLDOWN_TICKS = "inventory.alertCooldownTicks";
    private static final String CATEGORY_PREFIX = "category.";

    private final Path path;
    private final Map<AntiCheatCategory, AntiCheatAction> categoryActions = new EnumMap<>(AntiCheatCategory.class);
    private boolean enabled = true;
    private AntiCheatAction defaultAction = AntiCheatAction.AUDIT_ONLY;
    private Duration tempBanDuration = Duration.ofDays(7);
    private String appealUrl = "https://shd.gg/appeal";
    private int maxHistoryEntries = 250;
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
    private int combatAlertCooldownTicks = 100;
    private boolean inventoryChecksEnabled = true;
    private int inventoryScanIntervalTicks = 20;
    private int inventoryAlertCooldownTicks = 200;

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
        combatAlertCooldownTicks = intProperty(properties, COMBAT_ALERT_COOLDOWN_TICKS, combatAlertCooldownTicks);
        inventoryChecksEnabled = booleanProperty(properties, INVENTORY_CHECKS_ENABLED, inventoryChecksEnabled);
        inventoryScanIntervalTicks = intProperty(properties, INVENTORY_SCAN_INTERVAL_TICKS, inventoryScanIntervalTicks);
        inventoryAlertCooldownTicks = intProperty(properties, INVENTORY_ALERT_COOLDOWN_TICKS, inventoryAlertCooldownTicks);

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

    public int combatAlertCooldownTicks() {
        return combatAlertCooldownTicks;
    }

    public boolean inventoryChecksEnabled() {
        return inventoryChecksEnabled;
    }

    public int inventoryScanIntervalTicks() {
        return inventoryScanIntervalTicks;
    }

    public int inventoryAlertCooldownTicks() {
        return inventoryAlertCooldownTicks;
    }

    public String statusText() {
        return "enabled=%s defaultAction=%s tempBanMinutes=%d appealUrl=%s history=%d checks[movement=%s combat=%s inventory=%s] movement=burst%.1f/%.1f sustained%.2f air%.2f hover%d nofall%.1f combat=reach%.1f/y%.1f/min%d/cd%.2f/multi%d:%d inventory=scan%d overrides=%d".formatted(
                enabled,
                defaultAction,
                tempBanDuration.toMinutes(),
                appealUrl,
                maxHistoryEntries,
                movementChecksEnabled,
                combatChecksEnabled,
                inventoryChecksEnabled,
                movementMaxHorizontalPerTick,
                movementMaxVerticalPerTick,
                movementMaxSustainedHorizontalPerTick,
                movementMaxAirHorizontalPerTick,
                movementHoverTicks,
                movementNoFallMinDistance,
                combatMaxReachBlocks,
                combatMaxVerticalReachBlocks,
                combatMinAttackIntervalTicks,
                combatLowCooldownThreshold,
                combatMaxTargetsPerWindow,
                combatMultiTargetWindowTicks,
                inventoryScanIntervalTicks,
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
        properties.setProperty(COMBAT_ALERT_COOLDOWN_TICKS, Integer.toString(combatAlertCooldownTicks));
        properties.setProperty(INVENTORY_CHECKS_ENABLED, Boolean.toString(inventoryChecksEnabled));
        properties.setProperty(INVENTORY_SCAN_INTERVAL_TICKS, Integer.toString(inventoryScanIntervalTicks));
        properties.setProperty(INVENTORY_ALERT_COOLDOWN_TICKS, Integer.toString(inventoryAlertCooldownTicks));
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
}
