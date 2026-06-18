import { SlashCommandBuilder } from 'discord.js';
import { statements } from './db.js';
import { audit } from './logger.js';
import { hasStaffAccess, missingPermissionMessage } from './permissions.js';

const statusCommand = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show SHD bot and backend status.');

const auditCommand = new SlashCommandBuilder()
  .setName('audit')
  .setDescription('Staff audit tools.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('recent')
      .setDescription('Show recent audit events.')
      .addIntegerOption((option) =>
        option
          .setName('limit')
          .setDescription('Number of events to show.')
          .setMinValue(1)
          .setMaxValue(10)
      )
  );

export const commands = [
  statusCommand.toJSON(),
  auditCommand.toJSON()
];

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    await handleStatus(interaction);
    return;
  }

  if (interaction.commandName === 'audit') {
    await handleAudit(interaction);
  }
}

async function handleStatus(interaction) {
  const snapshot = statements.snapshot.get();
  audit('discord.status_command', {
    actorId: interaction.user.id,
    data: { guildId: interaction.guildId }
  });

  await interaction.reply({
    ephemeral: true,
    content: [
      '**SHD Bot Status**',
      `API state: ${snapshot.public_status.state}`,
      `Message: ${snapshot.public_status.message}`,
      `Audit events: ${snapshot.audit_events.length}`,
      `Discord ready: ${snapshot.service_health.discord_ready_at ? 'yes' : 'pending'}`
    ].join('\n')
  });
}

async function handleAudit(interaction) {
  if (!hasStaffAccess(interaction)) {
    await interaction.reply({ ephemeral: true, content: missingPermissionMessage('view audit events') });
    return;
  }

  const limit = interaction.options.getInteger('limit') ?? 5;
  const events = statements.recentAudit.all(limit);
  if (events.length === 0) {
    await interaction.reply({ ephemeral: true, content: 'No audit events yet.' });
    return;
  }

  await interaction.reply({
    ephemeral: true,
    content: events
      .map((event) => `#${event.id} ${event.type} <t:${Math.floor(event.created_at / 1000)}:R>`)
      .join('\n')
      .slice(0, 1900)
  });
}
