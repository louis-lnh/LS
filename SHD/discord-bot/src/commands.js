import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit } from './logger.js';
import { hasStaffAccess, missingPermissionMessage } from './permissions.js';
import { handleVerifyPanelCommand, handleRolePanelCommand } from './panels.js';
import { handleTicketPanelCommand, ticketTypeChoices } from './tickets.js';

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

const panelCommand = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Post SHD guild panels.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('ticket')
      .setDescription('Post a ticket panel in this channel.')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Ticket panel type.')
          .setRequired(true)
          .addChoices(...ticketTypeChoices)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('verify')
      .setDescription('Post the SHD verification acceptance panel.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('roles')
      .setDescription('Post the public role selection panel.')
  );

const setupCommand = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Check SHD bot guild readiness.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('check')
      .setDescription('Show missing roles, channels, and intent-dependent features.')
  );

export const commands = [
  statusCommand.toJSON(),
  auditCommand.toJSON(),
  panelCommand.toJSON(),
  setupCommand.toJSON()
];

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    await handleStatus(interaction);
    return;
  }

  if (interaction.commandName === 'audit') {
    await handleAudit(interaction);
    return;
  }

  if (interaction.commandName === 'panel') {
    await handlePanel(interaction);
    return;
  }

  if (interaction.commandName === 'setup') {
    await handleSetup(interaction);
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

async function handlePanel(interaction) {
  if (!hasStaffAccess(interaction)) {
    await interaction.reply({ ephemeral: true, content: missingPermissionMessage('post guild panels') });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'ticket') {
    await handleTicketPanelCommand(interaction);
    return;
  }
  if (subcommand === 'verify') {
    await handleVerifyPanelCommand(interaction);
    return;
  }
  if (subcommand === 'roles') {
    await handleRolePanelCommand(interaction);
  }
}

async function handleSetup(interaction) {
  if (!hasStaffAccess(interaction)) {
    await interaction.reply({ ephemeral: true, content: missingPermissionMessage('check setup') });
    return;
  }

  const snapshot = statements.snapshot.get();
  const roleEntries = Object.entries(config.roles)
    .filter(([, value]) => !Array.isArray(value))
    .map(([name, value]) => [name, Boolean(value)]);
  const channelEntries = Object.entries(config.channels).map(([name, value]) => [name, Boolean(value)]);

  audit('setup.check_command', {
    actorId: interaction.user.id,
    data: { guildId: interaction.guildId }
  });

  await interaction.reply({
    ephemeral: true,
    content: [
      '**SHD Setup Check**',
      `Open tickets: ${snapshot.ticket_threads.filter((ticket) => ticket.status === 'open').length}`,
      `Submission records: ${snapshot.support_submissions.length}`,
      '',
      '**Roles**',
      ...roleEntries.map(([name, value]) => `${value ? 'ok' : 'missing'} ${name}`),
      '',
      '**Channels**',
      ...channelEntries.map(([name, value]) => `${value ? 'ok' : 'missing'} ${name}`),
      '',
      '**Intent-dependent**',
      `${config.enableMessageContentIntent ? 'ok' : 'missing'} message-content intent for ticket key detection`,
      `${config.enableGuildMembersIntent ? 'ok' : 'missing'} guild-members intent for richer member workflows`
    ].join('\n').slice(0, 1900)
  });
}
