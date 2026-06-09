package com.shd.lifesteal.impl.player;

import com.mojang.brigadier.StringReader;
import com.mojang.brigadier.arguments.ArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.brigadier.exceptions.DynamicCommandExceptionType;
import com.mojang.brigadier.suggestion.Suggestions;
import com.mojang.brigadier.suggestion.SuggestionsBuilder;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import net.minecraft.command.CommandSource;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;

public final class WhitelistedPlayerArgumentType implements ArgumentType<String> {
    private static final Collection<String> EXAMPLES = List.of("Steve", "Alex");
    private static final DynamicCommandExceptionType PLAYER_NOT_FOUND = new DynamicCommandExceptionType(
            name -> Text.literal("Player '%s' is not online or whitelisted".formatted(name))
    );

    private final WhitelistPlayerResolver playerResolver;

    private WhitelistedPlayerArgumentType(WhitelistPlayerResolver playerResolver) {
        this.playerResolver = playerResolver;
    }

    public static WhitelistedPlayerArgumentType whitelistedPlayer(WhitelistPlayerResolver playerResolver) {
        return new WhitelistedPlayerArgumentType(playerResolver);
    }

    public static ResolvedPlayer getPlayer(
            CommandContext<ServerCommandSource> context,
            String name,
            WhitelistPlayerResolver playerResolver
    ) throws CommandSyntaxException {
        String playerName = StringArgumentType.getString(context, name);
        try {
            return playerResolver.resolve(context.getSource().getServer(), playerName);
        } catch (PlayerResolveException exception) {
            throw PLAYER_NOT_FOUND.create(playerName);
        }
    }

    @Override
    public String parse(StringReader reader) throws CommandSyntaxException {
        return StringArgumentType.word().parse(reader);
    }

    @Override
    public <S> CompletableFuture<Suggestions> listSuggestions(CommandContext<S> context, SuggestionsBuilder builder) {
        if (!(context.getSource() instanceof ServerCommandSource source)) {
            return Suggestions.empty();
        }

        return CommandSource.suggestMatching(playerResolver.suggestNames(source.getServer()), builder);
    }

    @Override
    public Collection<String> getExamples() {
        return EXAMPLES;
    }
}
