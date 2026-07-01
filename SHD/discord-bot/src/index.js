import { Client, Events, GatewayIntentBits } from 'discord.js';
import { assertRuntimeConfig, config } from './config.js';
import { statements } from './db.js';
import { audit, systemLog } from './logger.js';
import { handleInteraction } from './commands.js';
import { startWeb } from './web.js';
import { handlePanelInteraction } from './panels.js';
import { handleTicketInteraction, handleTicketMessage } from './tickets.js';
import { startTwitchLiveMonitor } from './twitch.js';

assertRuntimeConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    ...(config.enableGuildMembersIntent ? [GatewayIntentBits.GuildMembers] : []),
    ...(config.enableMessageContentIntent ? [
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ] : [])
  ]
});

client.once(Events.ClientReady, async () => {
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
  startTwitchLiveMonitor(client);
});

client.on('interactionCreate', async (interaction) => {
  await (async () => {
    if (await handlePanelInteraction(interaction)) return;
    if (await handleTicketInteraction(interaction)) return;
    await handleInteraction(interaction);
  })().catch(async (error) => {
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

client.on(Events.MessageCreate, async (message) => {
  await handleTicketMessage(message).catch(async (error) => {
    console.error('Ticket message handling failed:', error);
    audit('discord.message_error', {
      actorId: message.author?.id ?? null,
      data: {
        channelId: message.channel?.id ?? null,
        error: error.message
      }
    });
    await message.reply('Something went wrong while checking that ticket key.').catch(() => {});
  });
});

statements.updateHealth.run({ bot_started_at: Date.now() });
startWeb(client);
await client.login(config.discordToken);
