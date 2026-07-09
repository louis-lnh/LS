package com.shd.lifesteal.impl.kit;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Supplier;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.ContainerComponent;
import net.minecraft.component.type.NbtComponent;
import net.minecraft.component.type.PotionContentsComponent;
import net.minecraft.enchantment.Enchantment;
import net.minecraft.enchantment.Enchantments;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.Item;
import net.minecraft.item.equipment.trim.ArmorTrim;
import net.minecraft.item.equipment.trim.ArmorTrimMaterial;
import net.minecraft.item.equipment.trim.ArmorTrimMaterials;
import net.minecraft.item.equipment.trim.ArmorTrimPattern;
import net.minecraft.item.equipment.trim.ArmorTrimPatterns;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.potion.Potions;
import net.minecraft.registry.DynamicRegistryManager;
import net.minecraft.registry.RegistryEntryLookup;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Unit;

public final class EventKitService {
    private static final String EVENT_KIT_KEY = "shd_lifesteal_event_kit";
    private static final String EVENT_KIT_MACE_KEY = "shd_lifesteal_event_kit_mace";
    private static final List<String> KIT_NAMES = List.of(
            "Wemmbu",
            "FlameFrags",
            "Shared",
            "Tools",
            "Items",
            "Potions",
            "Potion Stack",
            "Potion Mix"
    );

    public List<String> kitNames() {
        return KIT_NAMES;
    }

    public int give(ServerCommandSource source, String name, boolean unbreakable) throws com.mojang.brigadier.exceptions.CommandSyntaxException {
        ServerPlayerEntity player = source.getPlayerOrThrow();
        BuildContext context = new BuildContext(source.getRegistryManager());
        ItemStack kit = buildKit(context, name, unbreakable);
        if (kit.isEmpty()) {
            source.sendError(Text.literal("Unknown kit: " + name));
            return 0;
        }

        player.giveOrDropStack(kit);
        source.sendFeedback(() -> Text.literal("Gave event kit: %s (unbreakable=%s)".formatted(
                displayName(name),
                unbreakable ? "yes" : "no"
        )), true);
        return 1;
    }

    private ItemStack buildKit(BuildContext context, String name, boolean unbreakable) {
        return switch (normalize(name)) {
            case "wemmbu", "wemmbuunbr", "unbrwemmbu" -> armorKit(context, "Wemmbu", unbreakable);
            case "flamefrags", "flamefragsunbr", "unbrflamefrags" -> armorKit(context, "FlameFrags", unbreakable);
            case "shared", "sharedunbr", "unbrshared" -> armorKit(context, "Shared", unbreakable);
            case "tools", "toolsunbr", "unbrtools" -> shulker("Tools", Items.GRAY_SHULKER_BOX, tools(context, unbreakable));
            case "items" -> shulker("Items", combatItems());
            case "potions" -> shulker("Potions", potions(false));
            case "potionstack", "potionstacked" -> shulker("Potion Stack", potions(true));
            case "potionsmix", "potionmix" -> shulker("Potions Mix", mixedPotions());
            default -> ItemStack.EMPTY;
        };
    }

    private ItemStack armorKit(BuildContext context, String name, boolean unbreakable) {
        ArmorTrimSet trims = ArmorTrimSet.forKit(name);
        ItemStack helmet = armor(context, Items.DIAMOND_HELMET, unbreakable, trims.helmet(), List.of(
                enchant(Enchantments.PROTECTION, 3),
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1),
                enchant(Enchantments.AQUA_AFFINITY, 1),
                enchant(Enchantments.RESPIRATION, 3)
        ));
        ItemStack chestplate = armor(context, Items.DIAMOND_CHESTPLATE, unbreakable, trims.chestplate(), List.of(
                enchant(Enchantments.PROTECTION, 3),
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1)
        ));
        ItemStack leggings = armor(context, Items.DIAMOND_LEGGINGS, unbreakable, trims.leggings(), List.of(
                enchant(Enchantments.PROTECTION, 3),
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1),
                enchant(Enchantments.SWIFT_SNEAK, 3)
        ));
        ItemStack boots = armor(context, Items.DIAMOND_BOOTS, unbreakable, trims.boots(), List.of(
                enchant(Enchantments.PROTECTION, 3),
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1),
                enchant(Enchantments.DEPTH_STRIDER, 3),
                enchant(Enchantments.SOUL_SPEED, 3),
                enchant(Enchantments.FEATHER_FALLING, 4)
        ));
        ItemStack shield = shield(context, name, unbreakable);
        List<ItemStack> row = List.of(helmet, chestplate, leggings, boots, shield, boots, leggings, chestplate, helmet);
        List<ItemStack> contents = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            row.forEach(stack -> contents.add(stack.copy()));
        }
        return shulker(name, armorKitShulker(name), contents);
    }

    private Item armorKitShulker(String name) {
        String normalized = name == null ? "" : name.toLowerCase(Locale.ROOT);
        if (normalized.contains("flamefrags")) {
            return Items.RED_SHULKER_BOX;
        }
        if (normalized.contains("wemmbu")) {
            return Items.PURPLE_SHULKER_BOX;
        }
        if (normalized.contains("shared")) {
            return Items.BLACK_SHULKER_BOX;
        }
        return Items.SHULKER_BOX;
    }

    private List<ItemStack> tools(BuildContext context, boolean unbreakable) {
        ItemStack sword = tool(context, Items.DIAMOND_SWORD, unbreakable, List.of(
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1),
                enchant(Enchantments.SHARPNESS, 4),
                enchant(Enchantments.LOOTING, 3),
                enchant(Enchantments.SWEEPING_EDGE, 3),
                enchant(Enchantments.FIRE_ASPECT, 2)
        ));
        ItemStack axe = tool(context, Items.DIAMOND_AXE, unbreakable, List.of(
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1),
                enchant(Enchantments.SHARPNESS, 4),
                enchant(Enchantments.SILK_TOUCH, 1),
                enchant(Enchantments.EFFICIENCY, 5)
        ));
        ItemStack spear = tool(context, Items.DIAMOND_SPEAR, unbreakable, List.of(
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1),
                enchant(Enchantments.SHARPNESS, 4),
                enchant(Enchantments.KNOCKBACK, 2),
                enchant(Enchantments.FIRE_ASPECT, 2)
        ));
        ItemStack pickaxe = tool(context, Items.NETHERITE_PICKAXE, unbreakable, List.of(
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1),
                enchant(Enchantments.EFFICIENCY, 5),
                enchant(Enchantments.SILK_TOUCH, 1)
        ));
        ItemStack bow = tool(context, Items.BOW, unbreakable, List.of(
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.INFINITY, 1),
                enchant(Enchantments.PUNCH, 2),
                enchant(Enchantments.FLAME, 1),
                enchant(Enchantments.POWER, 5)
        ));
        ItemStack crossbow = crossbow(context, unbreakable);
        return List.of(
                sword, empty(), empty(), empty(), empty(), empty(), empty(), empty(), bow,
                pickaxe, empty(), empty(), empty(), empty(), empty(), empty(), empty(), spear,
                axe, empty(), empty(), empty(), empty(), empty(), empty(), empty(), crossbow
        );
    }

    private List<ItemStack> combatItems() {
        return List.of(
                shulker("Items 1", itemLayoutOne()),
                shulker("Items 2", itemLayoutTwo()),
                shulker("Breeze Rods", fullShulker(Items.BREEZE_ROD)),
                shulker("Golden Apples", fullShulker(Items.GOLDEN_APPLE)),
                shulker("Cobwebs", fullShulker(Items.COBWEB)),
                shulker("Items 4", itemLayoutFour())
        );
    }

    private List<ItemStack> itemLayoutOne() {
        List<ItemStack> contents = new ArrayList<>();
        for (int slot = 0; slot < 27; slot++) {
            contents.add(slot == 13 ? stack(Items.BUCKET, 16) : stack(Items.WATER_BUCKET, 1));
        }
        return contents;
    }

    private List<ItemStack> itemLayoutTwo() {
        return List.of(
                stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64),
                stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), stack(Items.CHORUS_FRUIT, 64), empty(), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64),
                stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64), stack(Items.GOLDEN_CARROT, 64)
        );
    }

    private List<ItemStack> itemLayoutFour() {
        return List.of(
                stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.OAK_LOG, 64), stack(Items.OAK_LOG, 64), stack(Items.ENDER_CHEST, 64), stack(Items.OAK_LOG, 64), stack(Items.OAK_LOG, 64), stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.EXPERIENCE_BOTTLE, 64),
                stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.OAK_LOG, 64), stack(Items.OAK_LOG, 64), stack(Items.SPECTRAL_ARROW, 64), stack(Items.OAK_LOG, 64), stack(Items.OAK_LOG, 64), stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.EXPERIENCE_BOTTLE, 64),
                stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.SPECTRAL_ARROW, 64), stack(Items.SPECTRAL_ARROW, 64), stack(Items.SPECTRAL_ARROW, 64), stack(Items.SPECTRAL_ARROW, 64), stack(Items.SPECTRAL_ARROW, 64), stack(Items.EXPERIENCE_BOTTLE, 64), stack(Items.EXPERIENCE_BOTTLE, 64)
        );
    }

    private List<ItemStack> fullShulker(Item item) {
        List<ItemStack> contents = new ArrayList<>();
        for (int slot = 0; slot < 27; slot++) {
            contents.add(stack(item, 64));
        }
        return contents;
    }

    private List<ItemStack> potions(boolean stacked) {
        List<ItemStack> contents = new ArrayList<>();
        contents.add(potionShulker("Strength", Items.YELLOW_SHULKER_BOX, false,
                () -> splash("Strength", 1, Optional.empty(), new StatusEffectInstance(StatusEffects.STRENGTH, 9600, 0))));
        contents.add(potionShulker("Strength (99x)", Items.YELLOW_SHULKER_BOX, true,
                () -> splash("Strength", 99, Optional.empty(), new StatusEffectInstance(StatusEffects.STRENGTH, 9600, 0))));
        contents.add(potionShulker("Speed", Items.LIGHT_BLUE_SHULKER_BOX, false,
                () -> splash("Speed", 1, Optional.empty(), new StatusEffectInstance(StatusEffects.SPEED, 9600, 0))));
        contents.add(potionShulker("Speed (99x)", Items.LIGHT_BLUE_SHULKER_BOX, true,
                () -> splash("Speed", 99, Optional.empty(), new StatusEffectInstance(StatusEffects.SPEED, 9600, 0))));
        contents.add(potionShulker("Fire Resistance", Items.ORANGE_SHULKER_BOX, false,
                () -> splash("Fire Resistance", 1, Optional.empty(), new StatusEffectInstance(StatusEffects.FIRE_RESISTANCE, 9600, 0))));
        contents.add(potionShulker("Fire Resistance (99x)", Items.ORANGE_SHULKER_BOX, true,
                () -> splash("Fire Resistance", 99, Optional.empty(), new StatusEffectInstance(StatusEffects.FIRE_RESISTANCE, 9600, 0))));
        contents.add(potionShulker("Turtle Master IV", Items.BLACK_SHULKER_BOX, false,
                () -> splash("Turtle Master IV", 1, Optional.empty(), new StatusEffectInstance(StatusEffects.SLOWNESS, 400, 3), new StatusEffectInstance(StatusEffects.RESISTANCE, 400, 3))));
        contents.add(potionShulker("Instant Healing II", Items.RED_SHULKER_BOX, false,
                () -> splash("Instant Healing II", 1, Optional.empty(), new StatusEffectInstance(StatusEffects.INSTANT_HEALTH, 1, 1))));
        return contents;
    }

    private List<ItemStack> mixedPotions() {
        List<ItemStack> contents = new ArrayList<>();
        contents.add(potionShulker("SFS", Items.ORANGE_SHULKER_BOX, false,
                () -> splash("SFS", 1, Optional.of(1418839),
                        new StatusEffectInstance(StatusEffects.STRENGTH, 9600, 0),
                        new StatusEffectInstance(StatusEffects.SPEED, 9600, 0),
                        new StatusEffectInstance(StatusEffects.FIRE_RESISTANCE, 9600, 0))));
        contents.add(potionShulker("SFS (99x)", Items.ORANGE_SHULKER_BOX, true,
                () -> splash("SFS", 99, Optional.of(1418839),
                        new StatusEffectInstance(StatusEffects.STRENGTH, 9600, 0),
                        new StatusEffectInstance(StatusEffects.SPEED, 9600, 0),
                        new StatusEffectInstance(StatusEffects.FIRE_RESISTANCE, 9600, 0))));
        contents.add(potionShulker("Heal", Items.RED_SHULKER_BOX, false,
                () -> splash("Heal", 1, Optional.of(16711680),
                        new StatusEffectInstance(StatusEffects.ABSORPTION, 2400, 4),
                        new StatusEffectInstance(StatusEffects.REGENERATION, 200, 2),
                        new StatusEffectInstance(StatusEffects.INSTANT_HEALTH, 1, 1))));
        return contents;
    }

    private ItemStack armor(BuildContext context, Item item, boolean unbreakable, Optional<TrimSpec> trim, List<EnchantmentSpec> enchantments) {
        ItemStack stack = tool(context, item, unbreakable, enchantments);
        trim.ifPresent(spec -> stack.set(DataComponentTypes.TRIM, new ArmorTrim(
                context.trimMaterial(spec.material()),
                context.trimPattern(spec.pattern())
        )));
        return stack;
    }

    private ItemStack shield(BuildContext context, String kitName, boolean unbreakable) {
        ItemStack stack = tool(context, Items.SHIELD, unbreakable, List.of(
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1)
        ));
        stack.set(DataComponentTypes.CUSTOM_NAME, Text.literal(kitName + " Shield"));
        // TODO eventkit: apply shield banner/custom pattern once designs are final.
        return stack;
    }

    private ItemStack crossbow(BuildContext context, boolean unbreakable) {
        ItemStack stack = tool(context, Items.CROSSBOW, unbreakable, List.of(
                enchant(Enchantments.UNBREAKING, 3),
                enchant(Enchantments.MENDING, 1)
        ));
        return stack;
    }

    private ItemStack tool(BuildContext context, Item item, boolean unbreakable, List<EnchantmentSpec> enchantments) {
        ItemStack stack = tagged(new ItemStack(item));
        for (EnchantmentSpec enchantment : enchantments) {
            stack.addEnchantment(context.enchantment(enchantment.key()), enchantment.level());
        }
        if (unbreakable) {
            stack.set(DataComponentTypes.UNBREAKABLE, Unit.INSTANCE);
        }
        return stack;
    }

    private ItemStack shulker(String name, List<ItemStack> contents) {
        return shulker(name, Items.SHULKER_BOX, contents);
    }

    private ItemStack shulker(String name, Item item, List<ItemStack> contents) {
        ItemStack stack = tagged(new ItemStack(item));
        stack.set(DataComponentTypes.CUSTOM_NAME, Text.literal(name + " Kit"));
        stack.set(DataComponentTypes.CONTAINER, ContainerComponent.fromStacks(contents));
        return stack;
    }

    private ItemStack potionShulker(String name, Item shulkerItem, boolean stackable, Supplier<ItemStack> potionFactory) {
        List<ItemStack> contents = new ArrayList<>();
        for (int slot = 0; slot < 27; slot++) {
            ItemStack potion = potionFactory.get();
            if (stackable) {
                potion.set(DataComponentTypes.MAX_STACK_SIZE, 99);
            }
            contents.add(potion);
        }
        return shulker(name, shulkerItem, contents);
    }

    private ItemStack eventMace(ItemStack stack) {
        NbtComponent.set(DataComponentTypes.CUSTOM_DATA, stack, nbt -> nbt.putBoolean(EVENT_KIT_MACE_KEY, true));
        return stack;
    }

    private ItemStack tagged(ItemStack stack) {
        NbtComponent.set(DataComponentTypes.CUSTOM_DATA, stack, nbt -> nbt.putBoolean(EVENT_KIT_KEY, true));
        return stack;
    }

    private ItemStack stack(Item item, int count) {
        return tagged(new ItemStack(item, count));
    }

    private ItemStack empty() {
        return ItemStack.EMPTY;
    }

    private ItemStack potion(String name, int count, RegistryEntry<net.minecraft.potion.Potion> potion) {
        ItemStack stack = tagged(PotionContentsComponent.createStack(Items.SPLASH_POTION, potion));
        stack.setCount(count);
        stack.set(DataComponentTypes.CUSTOM_NAME, Text.literal(name));
        return stack;
    }

    private ItemStack splash(String name, int count, StatusEffectInstance... effects) {
        return splash(name, count, Optional.empty(), effects);
    }

    private ItemStack splash(String name, int count, Optional<Integer> color, StatusEffectInstance... effects) {
        ItemStack stack = tagged(new ItemStack(Items.SPLASH_POTION, count));
        PotionContentsComponent contents = new PotionContentsComponent(Optional.empty(), color, List.of(effects), Optional.empty());
        stack.set(DataComponentTypes.POTION_CONTENTS, contents);
        stack.set(DataComponentTypes.CUSTOM_NAME, Text.literal(name));
        return stack;
    }

    private EnchantmentSpec enchant(RegistryKey<Enchantment> key, int level) {
        return new EnchantmentSpec(key, level);
    }

    private String displayName(String name) {
        return KIT_NAMES.stream()
                .filter(kitName -> normalize(kitName).equals(normalize(name)))
                .findFirst()
                .orElse(name);
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replace(" ", "").replace("_", "").replace("-", "");
    }

    private record EnchantmentSpec(RegistryKey<Enchantment> key, int level) {
    }

    private record TrimSpec(
            RegistryKey<ArmorTrimPattern> pattern,
            RegistryKey<ArmorTrimMaterial> material
    ) {
    }

    private record ArmorTrimSet(
            Optional<TrimSpec> helmet,
            Optional<TrimSpec> chestplate,
            Optional<TrimSpec> leggings,
            Optional<TrimSpec> boots
    ) {
        private static ArmorTrimSet forKit(String name) {
            String normalized = name == null ? "" : name.toLowerCase(Locale.ROOT);
            if (normalized.contains("wemmbu")) {
                Optional<TrimSpec> raiserAmethyst = Optional.of(new TrimSpec(ArmorTrimPatterns.RAISER, ArmorTrimMaterials.AMETHYST));
                return new ArmorTrimSet(Optional.empty(), raiserAmethyst, raiserAmethyst, raiserAmethyst);
            }
            if (normalized.contains("flamefrags")) {
                Optional<TrimSpec> ribRedstone = Optional.of(new TrimSpec(ArmorTrimPatterns.RIB, ArmorTrimMaterials.REDSTONE));
                Optional<TrimSpec> ribGold = Optional.of(new TrimSpec(ArmorTrimPatterns.RIB, ArmorTrimMaterials.GOLD));
                return new ArmorTrimSet(ribRedstone, ribRedstone, ribGold, ribGold);
            }
            if (normalized.contains("shared")) {
                Optional<TrimSpec> eyeNetherite = Optional.of(new TrimSpec(ArmorTrimPatterns.EYE, ArmorTrimMaterials.NETHERITE));
                return new ArmorTrimSet(Optional.empty(), eyeNetherite, Optional.empty(), Optional.empty());
            }
            return new ArmorTrimSet(Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());
        }
    }

    private static final class BuildContext {
        private final RegistryEntryLookup<Enchantment> enchantments;
        private final RegistryEntryLookup<ArmorTrimMaterial> trimMaterials;
        private final RegistryEntryLookup<ArmorTrimPattern> trimPatterns;

        private BuildContext(DynamicRegistryManager registryManager) {
            this.enchantments = registryManager.getOrThrow(RegistryKeys.ENCHANTMENT);
            this.trimMaterials = registryManager.getOrThrow(RegistryKeys.TRIM_MATERIAL);
            this.trimPatterns = registryManager.getOrThrow(RegistryKeys.TRIM_PATTERN);
        }

        private RegistryEntry<Enchantment> enchantment(RegistryKey<Enchantment> key) {
            return enchantments.getOrThrow(key);
        }

        private RegistryEntry<ArmorTrimMaterial> trimMaterial(RegistryKey<ArmorTrimMaterial> key) {
            return trimMaterials.getOrThrow(key);
        }

        private RegistryEntry<ArmorTrimPattern> trimPattern(RegistryKey<ArmorTrimPattern> key) {
            return trimPatterns.getOrThrow(key);
        }
    }
}
