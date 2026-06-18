import { Client, GatewayIntentBits } from 'discord.js';
import { assertRuntimeConfig, config } from './config.js';
import { statements } from './db.js';
import { audit, systemLog } from './logger.js';
import { handleInteraction } from './commands.js';
import { startWeb } from './web.js';

assertRuntimeConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', async () => {
  statements.updateHealth.run({
    bot_started_at: statements.snapshot.get().service_health.bot_started_at ?? Date.now(),
    discord_ready_at: Date.now(),
    last_ready_user: client.user?.tag ?? null
  });
  audit('bot.ready', {
    actorId: client.user?.id ?? null,
    data: { tag: client.user?.tag ?? null, guildId: config.guildId }
  });
  console.log(`SHD Discord bot ready as ${client.user?.tag}`);
  await systemLog(client, 'SHD bot online', [
    { name: 'Bot', value: client.user?.tag ?? 'unknown', inline: true },
    { name: 'Guild', value: config.guildId, inline: true }
  ]);
});

client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction).catch(async (error) => {
    console.error('Interaction failed:', error);
    audit('discord.interaction_error', {
      actorId: interaction.user?.id ?? null,
      data: {
        commandName: interaction.isChatInputCommand() ? interaction.commandName : interaction.type,
        error: error.message
      }
    });

    const message = { ephemeral: true, content: 'Something went wrong while handling that command.' };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  });
});

statements.updateHealth.run({ bot_started_at: Date.now() });
startWeb(client);
await client.login(config.discordToken);
