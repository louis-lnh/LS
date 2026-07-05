package com.shd.lifesteal.impl.revival;

import com.shd.lifesteal.api.GameplayRoleSnapshot;
import java.util.List;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.screen.ScreenHandlerType;
import net.minecraft.screen.SimpleNamedScreenHandlerFactory;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.world.World;

public final class RevivalBeaconItem extends Item {
    private static final int ROWS = 6;
    private static final int SIZE = ROWS * 9;

    private final RevivalService revivalService;

    public RevivalBeaconItem(RevivalService revivalService, Settings settings) {
        super(settings);
        this.revivalService = revivalService;
    }

    @Override
    public ActionResult use(World world, PlayerEntity user, Hand hand) {
        if (world.isClient() || !(user instanceof ServerPlayerEntity player)) {
            return ActionResult.SUCCESS;
        }

        if (!revivalService.hasEliminatedPlayers(player.getEntityWorld().getServer())) {
            player.sendMessage(Text.literal("There are no eliminated players to revive."), true);
            return ActionResult.FAIL;
        }

        player.openHandledScreen(new SimpleNamedScreenHandlerFactory(
                (syncId, inventory, ignored) -> createScreenHandler(syncId, inventory, player, hand),
                Text.literal("Revival Beacon")
        ));
        return ActionResult.SUCCESS_SERVER;
    }

    private GenericContainerScreenHandler createScreenHandler(
            int syncId,
            net.minecraft.entity.player.PlayerInventory inventory,
            ServerPlayerEntity player,
            Hand hand
    ) {
        List<GameplayRoleSnapshot> eliminatedPlayers = revivalService.eliminatedPlayers(player.getEntityWorld().getServer());
        SimpleInventory menu = new SimpleInventory(SIZE);
        for (int index = 0; index < Math.min(SIZE, eliminatedPlayers.size()); index++) {
            GameplayRoleSnapshot target = eliminatedPlayers.get(index);
            ItemStack head = new ItemStack(Items.PLAYER_HEAD);
            String name = com.shd.lifesteal.impl.ui.UiNotifier.playerName(player.getEntityWorld().getServer(), target.playerId());
            head.set(net.minecraft.component.DataComponentTypes.PROFILE, net.minecraft.component.type.ProfileComponent.ofDynamic(target.playerId()));
            head.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME, Text.literal(name));
            menu.setStack(index, head);
        }

        return new RevivalSelectionScreenHandler(syncId, inventory, menu, eliminatedPlayers, player, hand, revivalService);
    }

    private static final class RevivalSelectionScreenHandler extends GenericContainerScreenHandler {
        private final List<GameplayRoleSnapshot> targets;
        private final ServerPlayerEntity player;
        private final Hand hand;
        private final RevivalService revivalService;

        private RevivalSelectionScreenHandler(
                int syncId,
                net.minecraft.entity.player.PlayerInventory playerInventory,
                SimpleInventory inventory,
                List<GameplayRoleSnapshot> targets,
                ServerPlayerEntity player,
                Hand hand,
                RevivalService revivalService
        ) {
            super(ScreenHandlerType.GENERIC_9X6, syncId, playerInventory, inventory, ROWS);
            this.targets = targets;
            this.player = player;
            this.hand = hand;
            this.revivalService = revivalService;
        }

        @Override
        public void onSlotClick(int slotIndex, int button, net.minecraft.screen.slot.SlotActionType actionType, PlayerEntity clicker) {
            if (!(clicker instanceof ServerPlayerEntity serverPlayer) || slotIndex < 0 || slotIndex >= SIZE) {
                return;
            }
            if (slotIndex >= targets.size()) {
                return;
            }

            ItemStack stack = serverPlayer.getStackInHand(hand);
            if (!(stack.getItem() instanceof RevivalBeaconItem)) {
                serverPlayer.sendMessage(Text.literal("Hold the Revival Beacon to finish the revive."), true);
                serverPlayer.closeHandledScreen();
                return;
            }

            GameplayRoleSnapshot target = targets.get(slotIndex);
            String targetName = com.shd.lifesteal.impl.ui.UiNotifier.playerName(serverPlayer.getEntityWorld().getServer(), target.playerId());
            RevivalService.RevivalResult result = revivalService.reviveByItem(serverPlayer, target.playerId(), targetName);
            if (!result.revived()) {
                serverPlayer.sendMessage(Text.literal(targetName + " is no longer eliminated."), true);
                serverPlayer.closeHandledScreen();
                return;
            }

            stack.decrementUnlessCreative(1, serverPlayer);
            serverPlayer.sendMessage(Text.literal("Revived " + targetName + " with " + result.hearts() + " hearts."), true);
            serverPlayer.closeHandledScreen();
        }

        @Override
        public ItemStack quickMove(PlayerEntity player, int slot) {
            return ItemStack.EMPTY;
        }
    }
}
