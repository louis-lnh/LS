package com.shd.lifesteal.impl.restriction;

import java.util.Optional;
import java.util.Set;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.FireworksComponent;
import net.minecraft.component.type.ItemEnchantmentsComponent;
import net.minecraft.component.type.PotionContentsComponent;
import net.minecraft.enchantment.Enchantment;
import net.minecraft.enchantment.Enchantments;
import net.minecraft.entity.effect.StatusEffect;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.Registries;
import net.minecraft.potion.Potions;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.entry.RegistryEntry;

public final class DisabledFeatureRules {
    private static final int MAX_FIREWORK_EXPLOSIONS = 7;
    private static final Set<Item> ALWAYS_DISABLED_ITEMS = Set.of(
            Items.END_CRYSTAL,
            Items.RESPAWN_ANCHOR,
            Items.TIPPED_ARROW,
            Items.TOTEM_OF_UNDYING,
            Items.TNT_MINECART,
            Items.NETHERITE_SWORD,
            Items.NETHERITE_AXE,
            Items.NETHERITE_SPEAR,
            Items.NETHERITE_HELMET,
            Items.NETHERITE_CHESTPLATE,
            Items.NETHERITE_LEGGINGS,
            Items.NETHERITE_BOOTS
    );

    private DisabledFeatureRules() {
    }

    public static boolean isUseBlocked(ItemStack stack, boolean inCombat) {
        return isUseBlocked(stack, inCombat, false);
    }

    public static boolean isUseBlocked(ItemStack stack, boolean inCombat, boolean spearCombatBan) {
        if (stack.isEmpty()) {
            return false;
        }

        if (isAlwaysDisabled(stack)) {
            return true;
        }

        if (isForbiddenPotion(stack, inCombat)) {
            return true;
        }

        if (isForbiddenFirework(stack)) {
            return true;
        }

        if (inCombat && isRiptideTrident(stack)) {
            return true;
        }

        if (inCombat && spearCombatBan && isSpear(stack)) {
            return true;
        }

        return inCombat && stack.isOf(Items.ENDER_PEARL);
    }

    public static boolean isInventoryBlocked(ItemStack stack, boolean inCombat) {
        if (isAlwaysDisabled(stack)) {
            return true;
        }

        if (isForbiddenPotion(stack, inCombat)) {
            return true;
        }

        if (isForbiddenFirework(stack)) {
            return true;
        }

        return false;
    }

    public static Optional<String> blockedReason(ItemStack stack, boolean inCombat) {
        if (stack.isEmpty()) {
            return Optional.empty();
        }

        String name = stack.getName().getString();
        if (isAlwaysDisabled(stack)) {
            return Optional.of(name + " is disabled this season.");
        }
        if (isForbiddenPotion(stack, inCombat)) {
            return Optional.of(name + " is restricted by the Lifesteal rules.");
        }
        if (isForbiddenFirework(stack)) {
            return Optional.of("Fireworks with more than " + MAX_FIREWORK_EXPLOSIONS + " explosions are disabled.");
        }
        if (inCombat && isRiptideTrident(stack)) {
            return Optional.of("Riptide tridents are disabled while combat tagged.");
        }
        if (inCombat && isSpear(stack)) {
            return Optional.of("Spears are disabled while combat tagged.");
        }
        if (inCombat && stack.isOf(Items.ENDER_PEARL)) {
            return Optional.of("Ender pearls are disabled while combat tagged.");
        }
        return Optional.empty();
    }

    public static boolean isRestrictedOutput(ItemStack stack) {
        return !stack.isEmpty()
                && (isAlwaysDisabled(stack) || isForbiddenFirework(stack) || hasRestrictedEnchantments(stack));
    }

    public static boolean clampRestrictedEnchantments(ItemStack stack) {
        boolean changed = false;
        changed |= clampEnchantments(stack, DataComponentTypes.ENCHANTMENTS);
        changed |= clampEnchantments(stack, DataComponentTypes.STORED_ENCHANTMENTS);
        return changed;
    }

    public static int maxAllowedLevel(RegistryEntry<Enchantment> enchantment) {
        if (matches(enchantment, Enchantments.PROTECTION)) {
            return 3;
        }
        if (matches(enchantment, Enchantments.SHARPNESS)) {
            return 4;
        }
        return -1;
    }

    public static boolean isRestrictedEnchantmentLevel(RegistryEntry<Enchantment> enchantment, int level) {
        int maxAllowed = maxAllowedLevel(enchantment);
        return maxAllowed > 0 && level > maxAllowed;
    }

    private static boolean isAlwaysDisabled(ItemStack stack) {
        return ALWAYS_DISABLED_ITEMS.stream().anyMatch(stack::isOf);
    }

    public static boolean isNormalWeaknessPotion(ItemStack stack) {
        if (!stack.isOf(Items.POTION)) {
            return false;
        }

        PotionContentsComponent potion = stack.get(DataComponentTypes.POTION_CONTENTS);
        return potion != null && potion.potion().filter(entry -> entry.equals(Potions.WEAKNESS) || entry.equals(Potions.LONG_WEAKNESS)).isPresent();
    }

    private static boolean isForbiddenPotion(ItemStack stack, boolean inCombat) {
        if (!stack.isOf(Items.POTION) && !stack.isOf(Items.SPLASH_POTION) && !stack.isOf(Items.LINGERING_POTION) && !stack.isOf(Items.TIPPED_ARROW)) {
            return false;
        }

        PotionContentsComponent potion = stack.get(DataComponentTypes.POTION_CONTENTS);
        if (potion == null || !potion.hasEffects()) {
            return false;
        }

        if (isTurtleMaster(potion)) {
            return false;
        }

        for (StatusEffectInstance effect : potion.getEffects()) {
            RegistryEntry<StatusEffect> effectType = effect.getEffectType();
            if (effectType.equals(StatusEffects.STRENGTH) && effect.getAmplifier() >= 1) {
                return true;
            }
            if (effectType.equals(StatusEffects.WEAKNESS)) {
                if (!isNormalWeaknessPotion(stack)) {
                    return true;
                }
                continue;
            }
            if (isDebuff(effectType)) {
                return true;
            }
        }

        return false;
    }

    private static boolean isDebuff(RegistryEntry<StatusEffect> effectType) {
        return effectType.equals(StatusEffects.POISON)
                || effectType.equals(StatusEffects.SLOWNESS)
                || effectType.equals(StatusEffects.MINING_FATIGUE)
                || effectType.equals(StatusEffects.NAUSEA)
                || effectType.equals(StatusEffects.BLINDNESS)
                || effectType.equals(StatusEffects.WITHER)
                || effectType.equals(StatusEffects.LEVITATION)
                || effectType.equals(StatusEffects.INSTANT_DAMAGE)
                || effectType.equals(StatusEffects.SLOW_FALLING);
    }

    private static boolean isTurtleMaster(PotionContentsComponent potion) {
        return potion.potion().filter(entry -> entry.equals(Potions.TURTLE_MASTER)
                || entry.equals(Potions.LONG_TURTLE_MASTER)
                || entry.equals(Potions.STRONG_TURTLE_MASTER)).isPresent();
    }

    private static boolean isForbiddenFirework(ItemStack stack) {
        if (!stack.isOf(Items.FIREWORK_ROCKET)) {
            return false;
        }

        FireworksComponent fireworks = stack.get(DataComponentTypes.FIREWORKS);
        return fireworks != null && fireworks.explosions().size() > MAX_FIREWORK_EXPLOSIONS;
    }

    private static boolean hasRestrictedEnchantments(ItemStack stack) {
        return hasRestrictedEnchantments(stack, DataComponentTypes.ENCHANTMENTS)
                || hasRestrictedEnchantments(stack, DataComponentTypes.STORED_ENCHANTMENTS);
    }

    private static boolean hasRestrictedEnchantments(ItemStack stack, net.minecraft.component.ComponentType<ItemEnchantmentsComponent> componentType) {
        ItemEnchantmentsComponent enchantments = stack.get(componentType);
        if (enchantments == null || enchantments.getSize() == 0) {
            return false;
        }

        for (RegistryEntry<Enchantment> enchantment : enchantments.getEnchantments()) {
            if (isRestrictedEnchantmentLevel(enchantment, enchantments.getLevel(enchantment))) {
                return true;
            }
        }
        return false;
    }

    private static boolean isRiptideTrident(ItemStack stack) {
        if (!stack.isOf(Items.TRIDENT)) {
            return false;
        }

        ItemEnchantmentsComponent enchantments = stack.get(DataComponentTypes.ENCHANTMENTS);
        return enchantments != null && enchantments.getEnchantments().stream().anyMatch(enchantment -> matches(enchantment, Enchantments.RIPTIDE));
    }

    public static boolean isSpear(ItemStack stack) {
        return !stack.isEmpty() && Registries.ITEM.getId(stack.getItem()).getPath().endsWith("_spear");
    }

    private static boolean clampEnchantments(ItemStack stack, net.minecraft.component.ComponentType<ItemEnchantmentsComponent> componentType) {
        ItemEnchantmentsComponent enchantments = stack.get(componentType);
        if (enchantments == null || enchantments.getSize() == 0) {
            return false;
        }

        ItemEnchantmentsComponent.Builder builder = new ItemEnchantmentsComponent.Builder(enchantments);
        boolean changed = false;
        for (RegistryEntry<Enchantment> enchantment : enchantments.getEnchantments()) {
            int level = enchantments.getLevel(enchantment);
            int maxAllowed = maxAllowedLevel(enchantment);
            if (maxAllowed > 0 && level > maxAllowed) {
                builder.set(enchantment, maxAllowed);
                changed = true;
            }
        }

        if (changed) {
            stack.set(componentType, builder.build());
        }
        return changed;
    }

    private static boolean matches(RegistryEntry<Enchantment> enchantment, RegistryKey<Enchantment> key) {
        return enchantment.matchesKey(key);
    }
}
