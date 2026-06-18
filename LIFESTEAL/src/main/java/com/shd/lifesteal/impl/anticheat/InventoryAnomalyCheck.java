package com.shd.lifesteal.impl.anticheat;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;

public final class InventoryAnomalyCheck implements AntiCheatCheck {
    private final Map<String, Long> lastAlertTicks = new HashMap<>();

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
        for (int slot = 0; slot < player.getInventory().size(); slot++) {
            checkStack(context, player, player.getInventory().getStack(slot), "inventory:" + slot);
        }

        for (EquipmentSlot slot : EquipmentSlot.VALUES) {
            checkStack(context, player, player.getEquippedStack(slot), "equipment:" + slot.asString());
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
    }

    private void checkStack(AntiCheatCheckContext context, ServerPlayerEntity player, ItemStack stack, String location) {
        if (stack.isEmpty()) {
            return;
        }

        if (stack.getCount() > stack.getMaxCount()) {
            alert(context, player, "inventory_oversized_stack", "Impossible item stack detected", location, stack, "count=%d max=%d".formatted(
                    stack.getCount(),
                    stack.getMaxCount()
            ));
        }

        if (stack.isDamageable() && stack.getDamage() > stack.getMaxDamage()) {
            alert(context, player, "inventory_invalid_damage", "Impossible item durability detected", location, stack, "damage=%d maxDamage=%d".formatted(
                    stack.getDamage(),
                    stack.getMaxDamage()
            ));
        }
    }

    private void alert(AntiCheatCheckContext context, ServerPlayerEntity player, String reasonCode, String publicReason, String location, ItemStack stack, String detail) {
        String alertKey = player.getUuid() + "|" + reasonCode + "|" + location;
        long lastAlertTick = lastAlertTicks.getOrDefault(alertKey, Long.MIN_VALUE);
        if (context.tick() - lastAlertTick < context.settings().inventoryAlertCooldownTicks()) {
            return;
        }
        lastAlertTicks.put(alertKey, context.tick());

        context.antiCheatService().handle(context.server(), player, new AntiCheatDetection(
                AntiCheatCategory.INVENTORY,
                AntiCheatSeverity.HIGH,
                reasonCode,
                publicReason,
                "check=%s location=%s item=%s %s".formatted(
                        id(),
                        location,
                        stack.getName().getString(),
                        detail
                ),
                AntiCheatAction.AUDIT_ONLY
        ));
    }
}
