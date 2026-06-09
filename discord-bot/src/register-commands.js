import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { assertRuntimeConfig, config } from './config.js';

assertRuntimeConfig();

const rest = new REST({ version: '10' }).setToken(config.discordToken);

await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
  body: commands
});

console.log(`Registered ${commands.length} guild slash commands.`);
