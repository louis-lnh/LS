package com.shd.lifesteal.impl.anticheat;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.minecraft.component.ComponentType;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.ItemEnchantmentsComponent;
import net.minecraft.enchantment.Enchantment;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.server.network.ServerPlayerEntity;

public final class InventoryAnomalyCheck implements AntiCheatCheck {
    private final Map<String, Long> lastAlertTicks = new HashMap<>();
    private final Map<UUID, Map<String, Integer>> previousItemTotals = new HashMap<>();

    @Override
    public String id() {
        return "inventory_anomaly";
    }

    @Override
    public void tick(AntiCheatCheckContext context) {
        if (!context.settings().inventoryChecksEnabled() || context.tick() % context.settings().inventoryScanIntervalTicks() != 0) {
            return;
        }

        ServerPlayerEntity player = context.player();
        Map<String, Integer> itemTotals = new HashMap<>();
        for (int slot = 0; slot < player.getInventory().size(); slot++) {
            ItemStack stack = player.getInventory().getStack(slot);
            checkStack(context, player, stack, "inventory:" + slot);
            addTotal(itemTotals, stack);
        }

        for (EquipmentSlot slot : EquipmentSlot.VALUES) {
            ItemStack stack = player.getEquippedStack(slot);
            checkStack(context, player, stack, "equipment:" + slot.asString());
            addTotal(itemTotals, stack);
        }

        if (context.settings().inventoryTrackItemDeltas() && !player.isCreative() && !player.isSpectator()) {
            checkItemDeltas(context, player, itemTotals);
        } else {
            previousItemTotals.put(player.getUuid(), itemTotals);
        }
    }

    @Override
    public void endServerTick(AntiCheatServerTickContext context) {
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
        previousItemTotals.keySet().removeIf(playerId -> !context.onlinePlayers().contains(playerId));
    }

    private void checkStack(AntiCheatCheckContext context, ServerPlayerEntity player, ItemStack stack, String location) {
        if (stack.isEmpty()) {
            return;
        }

        if (stack.getCount() > stack.getMaxCount()) {
            alert(context, player, AntiCheatSeverity.HIGH, "inventory_oversized_stack", "Impossible item stack detected", location, stack, "count=%d max=%d".formatted(
                    stack.getCount(),
                    stack.getMaxCount()
            ));
        }

        if (stack.getCount() > context.settings().inventoryMaxAllowedStackSize()) {
            alert(context, player, AntiCheatSeverity.HIGH, "inventory_stack_limit_bypass", "Impossible item stack size detected", location, stack, "count=%d configuredMax=%d stackMax=%d".formatted(
                    stack.getCount(),
                    context.settings().inventoryMaxAllowedStackSize(),
                    stack.getMaxCount()
            ));
        }

        Integer maxStackComponent = stack.get(DataComponentTypes.MAX_STACK_SIZE);
        if (maxStackComponent != null && maxStackComponent > context.settings().inventoryMaxAllowedStackSize()) {
            alert(context, player, AntiCheatSeverity.HIGH, "inventory_stack_component_override", "Unusual item stack component detected", location, stack, "componentMaxStack=%d configuredMax=%d count=%d".formatted(
                    maxStackComponent,
                    context.settings().inventoryMaxAllowedStackSize(),
                    stack.getCount()
            ));
        }

        if (stack.isDamageable() && (stack.getDamage() < 0 || stack.getDamage() > stack.getMaxDamage())) {
            alert(context, player, AntiCheatSeverity.HIGH, "inventory_invalid_damage", "Impossible item durability detected", location, stack, "damage=%d maxDamage=%d".formatted(
                    stack.getDamage(),
                    stack.getMaxDamage()
            ));
        }

        Integer maxDamageComponent = stack.get(DataComponentTypes.MAX_DAMAGE);
        if (maxDamageComponent != null && maxDamageComponent > context.settings().inventoryMaxAllowedDamage()) {
            alert(context, player, AntiCheatSeverity.WARNING, "inventory_damage_component_override", "Unusual item durability component detected", location, stack, "componentMaxDamage=%d configuredMax=%d stackMaxDamage=%d".formatted(
                    maxDamageComponent,
                    context.settings().inventoryMaxAllowedDamage(),
                    stack.getMaxDamage()
            ));
        }

        String itemName = stack.getName().getString();
        if (itemName.length() > context.settings().inventoryMaxItemNameLength()) {
            alert(context, player, AntiCheatSeverity.WARNING, "inventory_long_item_name", "Unusual item name detected", location, stack, "nameLength=%d configuredMax=%d".formatted(
                    itemName.length(),
                    context.settings().inventoryMaxItemNameLength()
            ));
        }

        checkEnchantments(context, player, stack, location, DataComponentTypes.ENCHANTMENTS, "enchantments");
        checkEnchantments(context, player, stack, location, DataComponentTypes.STORED_ENCHANTMENTS, "storedEnchantments");
    }

    private void checkEnchantments(
            AntiCheatCheckContext context,
            ServerPlayerEntity player,
            ItemStack stack,
            String location,
            ComponentType<ItemEnchantmentsComponent> componentType,
            String componentName
    ) {
        ItemEnchantmentsComponent enchantments = stack.get(componentType);
        if (enchantments == null || enchantments.getSize() == 0) {
            return;
        }

        for (RegistryEntry<Enchantment> enchantment : enchantments.getEnchantments()) {
            int level = enchantments.getLevel(enchantment);
            int vanillaMax = enchantment.value().getMaxLevel();
            int allowedMax = vanillaMax + context.settings().inventoryEnchantmentLevelTolerance();
            if (level > 0 && level <= allowedMax) {
                continue;
            }

            alert(context, player, AntiCheatSeverity.HIGH, "inventory_illegal_enchantment_level", "Illegal item enchantment detected", location, stack, "%s=%s level=%d vanillaMax=%d tolerance=%d allowedMax=%d".formatted(
                    componentName,
                    enchantment.toString(),
                    level,
                    vanillaMax,
                    context.settings().inventoryEnchantmentLevelTolerance(),
                    allowedMax
            ));
        }
    }

    private void checkItemDeltas(AntiCheatCheckContext context, ServerPlayerEntity player, Map<String, Integer> itemTotals) {
        Map<String, Integer> previousTotals = previousItemTotals.put(player.getUuid(), itemTotals);
        if (previousTotals == null) {
            return;
        }

        for (Map.Entry<String, Integer> entry : itemTotals.entrySet()) {
            int previous = previousTotals.getOrDefault(entry.getKey(), 0);
            int gained = entry.getValue() - previous;
            if (gained <= context.settings().inventoryMaxSingleScanItemGain()) {
                continue;
            }

            alert(context, player, AntiCheatSeverity.WARNING, "inventory_large_item_gain", "Unusual item gain detected", "inventory:total", entry.getKey(), "previous=%d current=%d gained=%d maxGainPerScan=%d scanIntervalTicks=%d".formatted(
                    previous,
                    entry.getValue(),
                    gained,
                    context.settings().inventoryMaxSingleScanItemGain(),
                    context.settings().inventoryScanIntervalTicks()
            ));
        }
    }

    private void addTotal(Map<String, Integer> itemTotals, ItemStack stack) {
        if (stack.isEmpty()) {
            return;
        }

        String itemId = Registries.ITEM.getId(stack.getItem()).toString();
        itemTotals.merge(itemId, stack.getCount(), Integer::sum);
    }

    private void alert(AntiCheatCheckContext context, ServerPlayerEntity player, AntiCheatSeverity severity, String reasonCode, String publicReason, String location, ItemStack stack, String detail) {
        alert(context, player, severity, reasonCode, publicReason, location, stack.getName().getString(), detail);
    }

    private void alert(AntiCheatCheckContext context, ServerPlayerEntity player, AntiCheatSeverity severity, String reasonCode, String publicReason, String location, String itemName, String detail) {
        String alertKey = player.getUuid() + "|" + reasonCode + "|" + location + "|" + itemName;
        long lastAlertTick = lastAlertTicks.getOrDefault(alertKey, Long.MIN_VALUE);
        if (context.tick() - lastAlertTick < context.settings().inventoryAlertCooldownTicks()) {
            return;
        }
        lastAlertTicks.put(alertKey, context.tick());

        context.antiCheatService().handle(context.server(), player, new AntiCheatDetection(
                AntiCheatCategory.INVENTORY,
                severity,
                reasonCode,
                publicReason,
                "check=%s location=%s item=%s %s".formatted(
                        id(),
                        location,
                        itemName,
                        detail
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
    }
}
