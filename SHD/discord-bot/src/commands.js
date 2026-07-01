import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, staffAuditLog } from './logger.js';
import { hasStaffAccess, missingPermissionMessage } from './permissions.js';
import { handleVerifyPanelCommand, handleRolePanelCommand } from './panels.js';
import { siteConfigured, siteDelete, siteGet, sitePatch, sitePost } from './site-client.js';
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
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('launch')
      .setDescription('Show the guild launch readiness checklist.')
  );

const purgeCommand = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete recent messages in this channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption((option) =>
    option
      .setName('amount')
      .setDescription('Number of recent messages to delete.')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('Only delete recent messages from this user.')
  )
  .addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Reason for the purge.')
      .setMaxLength(500)
  );

const banCommand = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from the guild.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((option) => option.setName('user').setDescription('User to ban.').setRequired(true))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the ban.').setMaxLength(500))
  .addIntegerOption((option) =>
    option
      .setName('delete_days')
      .setDescription('Delete recent message history from this many days.')
      .setMinValue(0)
      .setMaxValue(7)
  );

const unbanCommand = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user by Discord user ID.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption((option) => option.setName('user_id').setDescription('Discord user ID to unban.').setRequired(true).setMaxLength(32))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the unban.').setMaxLength(500));

const kickCommand = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the guild.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((option) => option.setName('user').setDescription('Member to kick.').setRequired(true))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the kick.').setMaxLength(500));

const timeoutCommand = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Timeout a member.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('user').setDescription('Member to timeout.').setRequired(true))
  .addStringOption((option) => option.setName('duration').setDescription('Duration, e.g. 10m, 1h, 1d.').setRequired(true).setMaxLength(20))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the timeout.').setMaxLength(500));

const untimeoutCommand = new SlashCommandBuilder()
  .setName('untimeout')
  .setDescription('Remove a member timeout.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('user').setDescription('Member to remove timeout from.').setRequired(true))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for removing timeout.').setMaxLength(500));

const warnCommand = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a member and store a mod case.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('user').setDescription('Member to warn.').setRequired(true))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the warning.').setRequired(true).setMaxLength(500));

const warningsCommand = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('Show recent warnings for a member.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('user').setDescription('Member to check.').setRequired(true))
  .addIntegerOption((option) => option.setName('limit').setDescription('Warnings to show.').setMinValue(1).setMaxValue(10));

const clearWarningCommand = new SlashCommandBuilder()
  .setName('clear-warning')
  .setDescription('Mark a warning case as cleared.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addIntegerOption((option) => option.setName('case_id').setDescription('Warning case ID.').setRequired(true).setMinValue(1))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for clearing the warning.').setMaxLength(500));

const modLogsCommand = new SlashCommandBuilder()
  .setName('modlogs')
  .setDescription('Show recent moderation cases for a member.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('user').setDescription('Member to check.').setRequired(true))
  .addIntegerOption((option) => option.setName('limit').setDescription('Cases to show.').setMinValue(1).setMaxValue(10));

const caseCommand = new SlashCommandBuilder()
  .setName('case')
  .setDescription('Show one moderation case.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addIntegerOption((option) => option.setName('case_id').setDescription('Moderation case ID.').setRequired(true).setMinValue(1));

const lockCommand = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock a channel for @everyone.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) => option.setName('channel').setDescription('Channel to lock. Defaults to current channel.'))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for locking.').setMaxLength(500));

const unlockCommand = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock a channel for @everyone.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) => option.setName('channel').setDescription('Channel to unlock. Defaults to current channel.'))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for unlocking.').setMaxLength(500));

const slowmodeCommand = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set channel slowmode.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption((option) =>
    option
      .setName('seconds')
      .setDescription('Slowmode seconds. Use 0 to disable.')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(21600)
  )
  .addChannelOption((option) => option.setName('channel').setDescription('Channel to update. Defaults to current channel.'))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for slowmode change.').setMaxLength(500));

const userInfoCommand = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Show Discord member information.')
  .addUserOption((option) => option.setName('user').setDescription('User to inspect. Defaults to you.'));

const supportCommand = new SlashCommandBuilder()
  .setName('support')
  .setDescription('Show how to get help from SHD staff.');

const notificationCommand = new SlashCommandBuilder()
  .setName('notification')
  .setDescription('Send a staff notification embed in this channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((option) =>
    option.setName('title').setDescription('Notification title.').setRequired(true).setMaxLength(120)
  )
  .addStringOption((option) =>
    option.setName('message').setDescription('Notification message.').setRequired(true).setMaxLength(2000)
  )
  .addStringOption((option) =>
    option
      .setName('style')
      .setDescription('Notification style.')
      .addChoices(
        { name: 'Info', value: 'info' },
        { name: 'Success', value: 'success' },
        { name: 'Warning', value: 'warning' },
        { name: 'Danger', value: 'danger' },
        { name: 'Event', value: 'event' }
      )
  )
  .addStringOption((option) =>
    option.setName('footer').setDescription('Optional footer text.').setMaxLength(120)
  );

const siteCommand = new SlashCommandBuilder()
  .setName('site')
  .setDescription('Control SHD website content through the internal site API.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('status')
      .setDescription('Check the protected SHD site bot API.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List website content and useful IDs.')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Which content to list.')
          .addChoices(
            { name: 'summary', value: 'summary' },
            { name: 'roster', value: 'roster' },
            { name: 'matches', value: 'matches' },
            { name: 'clips', value: 'clips' },
            { name: 'announcements', value: 'announcements' },
            { name: 'audit', value: 'audit' }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName('limit')
          .setDescription('Rows to show.')
          .setMinValue(1)
          .setMaxValue(10)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('announce')
      .setDescription('Stage a website announcement.')
      .addStringOption((option) => option.setName('title').setDescription('Announcement title.').setRequired(true).setMaxLength(120))
      .addStringOption((option) => option.setName('body').setDescription('Announcement body.').setRequired(true).setMaxLength(2000))
      .addStringOption((option) =>
        option
          .setName('kind')
          .setDescription('Announcement type.')
          .addChoices(
            { name: 'site', value: 'site' },
            { name: 'match', value: 'match' },
            { name: 'result', value: 'result' },
            { name: 'roster', value: 'roster' },
            { name: 'clip', value: 'clip' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('match')
      .setDescription('Stage an upcoming website match.')
      .addStringOption((option) => option.setName('opponent').setDescription('Opponent name.').setRequired(true).setMaxLength(120))
      .addStringOption((option) => option.setName('starts_at').setDescription('ISO date/time or readable schedule text.').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('event_type').setDescription('Premier, scrim, tournament, or showmatch.').setMaxLength(40))
      .addStringOption((option) => option.setName('maps').setDescription('Comma-separated map list.').setMaxLength(200))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('result')
      .setDescription('Stage a website match result.')
      .addStringOption((option) => option.setName('match_id').setDescription('Website match id.').setRequired(true).setMaxLength(80))
      .addStringOption((option) =>
        option
          .setName('result')
          .setDescription('Match result.')
          .setRequired(true)
          .addChoices(
            { name: 'win', value: 'win' },
            { name: 'loss', value: 'loss' },
            { name: 'draw', value: 'draw' },
            { name: 'pending', value: 'pending' }
          )
      )
      .addStringOption((option) => option.setName('score').setDescription('Score, for example 13-9.').setRequired(true).setMaxLength(40))
      .addStringOption((option) => option.setName('notes').setDescription('Short review notes.').setMaxLength(1000))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('edit-match')
      .setDescription('Edit an existing website match.')
      .addStringOption((option) => option.setName('match_id').setDescription('Website match id.').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('opponent').setDescription('Opponent name.').setMaxLength(120))
      .addStringOption((option) => option.setName('starts_at').setDescription('ISO date/time or readable schedule text.').setMaxLength(80))
      .addStringOption((option) => option.setName('event_type').setDescription('Premier, scrim, tournament, or showmatch.').setMaxLength(40))
      .addStringOption((option) => option.setName('maps').setDescription('Comma-separated map list.').setMaxLength(200))
      .addStringOption((option) => option.setName('notes').setDescription('Short review notes.').setMaxLength(1000))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('vod')
      .setDescription('Attach a VOD link to a website match.')
      .addStringOption((option) => option.setName('match_id').setDescription('Website match id.').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('url').setDescription('VOD URL.').setRequired(true).setMaxLength(500))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('clip')
      .setDescription('Stage a website clip.')
      .addStringOption((option) => option.setName('title').setDescription('Clip title.').setRequired(true).setMaxLength(140))
      .addStringOption((option) => option.setName('player').setDescription('Player name.').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('url').setDescription('Clip URL.').setRequired(true).setMaxLength(500))
      .addStringOption((option) => option.setName('map').setDescription('Map name.').setMaxLength(80))
      .addStringOption((option) => option.setName('tags').setDescription('Comma-separated tags.').setMaxLength(200))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('edit-clip')
      .setDescription('Edit an existing website clip.')
      .addStringOption((option) => option.setName('clip_id').setDescription('Website clip id.').setRequired(true).setMaxLength(120))
      .addStringOption((option) => option.setName('title').setDescription('Clip title.').setMaxLength(140))
      .addStringOption((option) => option.setName('player').setDescription('Player name.').setMaxLength(80))
      .addStringOption((option) => option.setName('url').setDescription('Clip URL.').setMaxLength(500))
      .addStringOption((option) => option.setName('map').setDescription('Map name.').setMaxLength(80))
      .addStringOption((option) => option.setName('tags').setDescription('Comma-separated tags.').setMaxLength(200))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('edit-announce')
      .setDescription('Edit an existing website announcement.')
      .addStringOption((option) => option.setName('announcement_id').setDescription('Website announcement id.').setRequired(true).setMaxLength(140))
      .addStringOption((option) => option.setName('title').setDescription('Announcement title.').setMaxLength(120))
      .addStringOption((option) => option.setName('body').setDescription('Announcement body.').setMaxLength(2000))
      .addStringOption((option) =>
        option
          .setName('kind')
          .setDescription('Announcement type.')
          .addChoices(
            { name: 'site', value: 'site' },
            { name: 'match', value: 'match' },
            { name: 'result', value: 'result' },
            { name: 'roster', value: 'roster' },
            { name: 'clip', value: 'clip' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('roster')
      .setDescription('Stage a website roster/member update.')
      .addStringOption((option) => option.setName('name').setDescription('Display name.').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('riot_id').setDescription('Riot ID.').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('peak').setDescription('Peak rank key, for example ascendant-1.').setMaxLength(40))
      .addStringOption((option) => option.setName('agents').setDescription('Comma-separated preferred agents.').setMaxLength(200))
      .addStringOption((option) => option.setName('status').setDescription('main, sub, staff, or inactive.').setMaxLength(40))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('record')
      .setDescription('Stage the Premier record shown on the website.')
      .addIntegerOption((option) => option.setName('wins').setDescription('Wins.').setRequired(true).setMinValue(0))
      .addIntegerOption((option) => option.setName('losses').setDescription('Losses.').setRequired(true).setMinValue(0))
      .addStringOption((option) => option.setName('season').setDescription('Season label.').setMaxLength(80))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('Delete website content by id.')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Content type.')
          .setRequired(true)
          .addChoices(
            { name: 'match', value: 'match' },
            { name: 'clip', value: 'clip' },
            { name: 'announcement', value: 'announcement' },
            { name: 'roster', value: 'roster' }
          )
      )
      .addStringOption((option) => option.setName('id').setDescription('Website content id.').setRequired(true).setMaxLength(140))
  );

export const commands = [
  statusCommand.toJSON(),
  auditCommand.toJSON(),
  panelCommand.toJSON(),
  setupCommand.toJSON(),
  purgeCommand.toJSON(),
  banCommand.toJSON(),
  unbanCommand.toJSON(),
  kickCommand.toJSON(),
  timeoutCommand.toJSON(),
  untimeoutCommand.toJSON(),
  warnCommand.toJSON(),
  warningsCommand.toJSON(),
  clearWarningCommand.toJSON(),
  modLogsCommand.toJSON(),
  caseCommand.toJSON(),
  lockCommand.toJSON(),
  unlockCommand.toJSON(),
  slowmodeCommand.toJSON(),
  userInfoCommand.toJSON(),
  supportCommand.toJSON(),
  notificationCommand.toJSON(),
  siteCommand.toJSON()
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
    return;
  }

  if (interaction.commandName === 'notification') {
    await handleNotification(interaction);
    return;
  }

  if ([
    'purge',
    'ban',
    'unban',
    'kick',
    'timeout',
    'untimeout',
    'warn',
    'warnings',
    'clear-warning',
    'modlogs',
    'case',
    'lock',
    'unlock',
    'slowmode',
    'userinfo',
    'support'
  ].includes(interaction.commandName)) {
    await handleUtilityCommand(interaction);
    return;
  }

  if (interaction.commandName === 'site') {
    await handleSite(interaction);
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

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'launch') {
    await handleLaunchReadiness(interaction);
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

async function handleLaunchReadiness(interaction) {
  const snapshot = statements.snapshot.get();
  const report = launchReadinessReport(snapshot);

  audit('setup.launch_command', {
    actorId: interaction.user.id,
    data: {
      guildId: interaction.guildId,
      missing: report.missing.length,
      warnings: report.warnings.length
    }
  });

  await interaction.reply({
    ephemeral: true,
    content: [
      '**SHD Guild Launch Readiness**',
      `Status: ${report.ready ? 'ready for soft launch' : 'not ready yet'}`,
      '',
      '**Required**',
      ...(report.required.length ? report.required : ['pass no required blockers found']),
      '',
      '**Recommended**',
      ...(report.recommended.length ? report.recommended : ['pass recommended setup looks good']),
      '',
      '**Operational State**',
      ...report.operational
    ].join('\n').slice(0, 1900)
  });
}

function launchReadinessReport(snapshot) {
  const required = [
    check('bot token configured', Boolean(config.discordToken)),
    check('client id configured', Boolean(config.clientId)),
    check('guild id configured', Boolean(config.guildId)),
    check('verified role configured', Boolean(config.roles.verified)),
    check('member role configured', Boolean(config.roles.member)),
    check('at least one staff/admin role configured', [
      ...config.roles.staff,
      ...config.roles.admins,
      ...config.roles.moderators,
      ...config.roles.support,
      ...config.roles.developers
    ].length > 0 || config.owners.discordIds.length > 0),
    check('system log channel configured', Boolean(config.channels.systemLog)),
    check('staff audit channel configured', Boolean(config.channels.staffAudit)),
    check('support log channel configured', Boolean(config.channels.supportLog)),
    check('ticket notification channel configured', Boolean(config.channels.ticketNotify)),
    check('API shared secret configured', Boolean(config.apiSharedSecret)),
    check('SHD site internal token configured', Boolean(config.shdSite.internalToken))
  ];

  const panelTypes = new Set(snapshot.role_panel_messages.map((panel) => panel.type));
  const recommended = [
    check('public site URL configured', Boolean(config.websites.publicSite), 'warn'),
    check('SHD site internal API base URL configured', Boolean(config.shdSite.internalBaseUrl), 'warn'),
    check('support site URL configured', Boolean(config.websites.supportSite), 'warn'),
    check('admin site URL configured', Boolean(config.websites.adminSite), 'warn'),
    check('Discord OAuth admin session configured', config.admin.enabled, 'warn'),
    check('message-content intent enabled for ticket key detection', config.enableMessageContentIntent, 'warn'),
    check('guild-members intent enabled for richer member workflows', config.enableGuildMembersIntent, 'warn'),
    check('verification panel has been posted', panelTypes.has('verify'), 'warn'),
    check('role selection panel has been posted', panelTypes.has('roles'), 'warn'),
    check('announcement role configured', Boolean(config.roles.announcements), 'warn'),
    check('events role configured', Boolean(config.roles.events), 'warn'),
    check('support ping role configured', Boolean(config.roles.supportPing), 'warn'),
    check('live notification role configured', Boolean(config.roles.live), 'warn'),
    check('Twitch live channel configured', Boolean(config.channels.twitchLive), 'warn'),
    check('Twitch app credentials configured', Boolean(config.twitch.clientId && config.twitch.clientSecret), 'warn'),
    check('Twitch usernames configured', config.twitch.usernames.length > 0, 'warn')
  ];

  const openTickets = snapshot.ticket_threads.filter((ticket) => ticket.status === 'open').length;
  const operational = [
    `bot ready: ${snapshot.service_health.discord_ready_at ? 'yes' : 'pending'}`,
    `API ready: ${snapshot.service_health.api_started_at ? 'yes' : 'pending'}`,
    `status: ${snapshot.public_status.state} - ${snapshot.public_status.message}`,
    `audit events: ${snapshot.audit_events.length}`,
    `support submissions: ${snapshot.support_submissions.length}`,
    `open tickets: ${openTickets}`,
    `stored panel records: ${snapshot.role_panel_messages.length}`
  ];

  const missing = required.filter((item) => item.startsWith('missing'));
  const warnings = recommended.filter((item) => item.startsWith('warn'));

  return {
    ready: missing.length === 0,
    missing,
    warnings,
    required,
    recommended,
    operational
  };
}

function check(label, passed, level = 'missing') {
  if (passed) return `pass ${label}`;
  return `${level} ${label}`;
}

async function handleUtilityCommand(interaction) {
  if (interaction.commandName === 'support') {
    await handleSupportCommand(interaction);
    return;
  }

  if (interaction.commandName === 'userinfo') {
    await handleUserInfoCommand(interaction);
    return;
  }

  if (!hasStaffAccess(interaction)) {
    await interaction.reply({ ephemeral: true, content: missingPermissionMessage('use moderation commands') });
    return;
  }

  if (interaction.commandName === 'purge') {
    await handlePurgeCommand(interaction);
    return;
  }
  if (interaction.commandName === 'ban') {
    await handleBanCommand(interaction);
    return;
  }
  if (interaction.commandName === 'unban') {
    await handleUnbanCommand(interaction);
    return;
  }
  if (interaction.commandName === 'kick') {
    await handleKickCommand(interaction);
    return;
  }
  if (interaction.commandName === 'timeout') {
    await handleTimeoutCommand(interaction);
    return;
  }
  if (interaction.commandName === 'untimeout') {
    await handleUntimeoutCommand(interaction);
    return;
  }
  if (interaction.commandName === 'warn') {
    await handleWarnCommand(interaction);
    return;
  }
  if (interaction.commandName === 'warnings') {
    await handleWarningsCommand(interaction);
    return;
  }
  if (interaction.commandName === 'clear-warning') {
    await handleClearWarningCommand(interaction);
    return;
  }
  if (interaction.commandName === 'modlogs') {
    await handleModLogsCommand(interaction);
    return;
  }
  if (interaction.commandName === 'case') {
    await handleCaseCommand(interaction);
    return;
  }
  if (interaction.commandName === 'lock' || interaction.commandName === 'unlock') {
    await handleLockCommand(interaction, interaction.commandName === 'lock');
    return;
  }
  if (interaction.commandName === 'slowmode') {
    await handleSlowmodeCommand(interaction);
  }
}

const notificationStyles = {
  info: { color: 0x2f80ed, label: 'Info' },
  success: { color: 0x2f7d67, label: 'Success' },
  warning: { color: 0xffb020, label: 'Warning' },
  danger: { color: 0xd94848, label: 'Danger' },
  event: { color: 0x8b5cf6, label: 'Event' }
};

async function handleNotification(interaction) {
  if (!hasStaffAccess(interaction)) {
    await interaction.reply({ ephemeral: true, content: missingPermissionMessage('send notifications') });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel;
  if (!channel?.isTextBased()) {
    await interaction.editReply('This command must be used in a text channel.');
    return;
  }

  const title = interaction.options.getString('title', true).trim();
  const message = interaction.options.getString('message', true).trim();
  const style = interaction.options.getString('style') ?? 'info';
  const footer = interaction.options.getString('footer')?.trim();
  const styleConfig = notificationStyles[style] ?? notificationStyles.info;

  if (!title || !message) {
    await interaction.editReply('Title and message cannot be empty.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(message)
    .setColor(styleConfig.color)
    .setTimestamp(new Date())
    .setFooter({ text: footer || `SHD - sent by ${interaction.user.tag}` });

  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  audit('notification.sent', {
    actorId: interaction.user.id,
    data: { channelId: channel.id, title, style }
  });
  await staffAuditLog(interaction.client, 'Notification Sent', [
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
    { name: 'Style', value: styleConfig.label, inline: true },
    { name: 'Title', value: title }
  ]);
  await interaction.editReply(`Notification sent in <#${channel.id}>.`);
}

async function handlePurgeCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const amount = interaction.options.getInteger('amount', true);
  const targetUser = interaction.options.getUser('user');
  const reason = moderationReason(interaction);
  const channel = interaction.channel;

  if (!channel?.isTextBased() || typeof channel.bulkDelete !== 'function') {
    await interaction.editReply('This channel does not support bulk message deletion.');
    return;
  }

  const fetched = await channel.messages.fetch({ limit: 100 });
  const messages = [...fetched.values()]
    .filter((message) => !targetUser || message.author.id === targetUser.id)
    .slice(0, amount);

  if (messages.length === 0) {
    await interaction.editReply('No matching recent messages found.');
    return;
  }

  const deleted = await channel.bulkDelete(messages, true);
  const modCase = await createModerationCase(interaction, {
    type: 'purge',
    targetUser,
    reason,
    channelId: channel.id,
    messageCount: deleted.size,
    metadata: { requestedAmount: amount }
  });

  await interaction.editReply(`Deleted ${deleted.size} message(s). Case #${modCase.id}.`);
}

async function handleBanCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const targetUser = interaction.options.getUser('user', true);
  const reason = moderationReason(interaction);
  const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

  const block = moderationTargetBlock(interaction, targetUser, targetMember, 'ban');
  if (block) {
    await interaction.editReply(block);
    return;
  }

  await interaction.guild.members.ban(targetUser.id, {
    deleteMessageSeconds: deleteDays * 86400,
    reason: auditReason(interaction, reason)
  });
  const modCase = await createModerationCase(interaction, {
    type: 'ban',
    targetUser,
    reason,
    metadata: { deleteDays }
  });

  await interaction.editReply(`Banned ${targetUser.tag}. Case #${modCase.id}.`);
}

async function handleUnbanCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.options.getString('user_id', true).trim();
  const reason = moderationReason(interaction);

  await interaction.guild.bans.remove(userId, auditReason(interaction, reason));
  const modCase = await createModerationCase(interaction, {
    type: 'unban',
    targetId: userId,
    reason
  });

  await interaction.editReply(`Unbanned ${userId}. Case #${modCase.id}.`);
}

async function handleKickCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const targetUser = interaction.options.getUser('user', true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const reason = moderationReason(interaction);

  const block = moderationTargetBlock(interaction, targetUser, targetMember, 'kick');
  if (block) {
    await interaction.editReply(block);
    return;
  }
  if (!targetMember?.kickable) {
    await interaction.editReply('I cannot kick that member. Check my role position and permissions.');
    return;
  }

  await targetMember.kick(auditReason(interaction, reason));
  const modCase = await createModerationCase(interaction, {
    type: 'kick',
    targetUser,
    reason
  });

  await interaction.editReply(`Kicked ${targetUser.tag}. Case #${modCase.id}.`);
}

async function handleTimeoutCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const targetUser = interaction.options.getUser('user', true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const durationInput = interaction.options.getString('duration', true);
  const durationMs = parseDurationMs(durationInput);
  const reason = moderationReason(interaction);

  if (!durationMs) {
    await interaction.editReply('Invalid duration. Use values like `10m`, `1h`, `1d`, or `2w`.');
    return;
  }
  if (durationMs > 28 * 24 * 60 * 60 * 1000) {
    await interaction.editReply('Discord timeouts can be at most 28 days.');
    return;
  }

  const block = moderationTargetBlock(interaction, targetUser, targetMember, 'timeout');
  if (block) {
    await interaction.editReply(block);
    return;
  }
  if (!targetMember?.moderatable) {
    await interaction.editReply('I cannot timeout that member. Check my role position and permissions.');
    return;
  }

  await targetMember.timeout(durationMs, auditReason(interaction, reason));
  const modCase = await createModerationCase(interaction, {
    type: 'timeout',
    targetUser,
    reason,
    durationMs
  });

  await interaction.editReply(`Timed out ${targetUser.tag} for ${formatDuration(durationMs)}. Case #${modCase.id}.`);
}

async function handleUntimeoutCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const targetUser = interaction.options.getUser('user', true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const reason = moderationReason(interaction);

  const block = moderationTargetBlock(interaction, targetUser, targetMember, 'untimeout');
  if (block) {
    await interaction.editReply(block);
    return;
  }
  if (!targetMember?.moderatable) {
    await interaction.editReply('I cannot remove timeout from that member. Check my role position and permissions.');
    return;
  }

  await targetMember.timeout(null, auditReason(interaction, reason));
  const modCase = await createModerationCase(interaction, {
    type: 'untimeout',
    targetUser,
    reason
  });

  await interaction.editReply(`Removed timeout from ${targetUser.tag}. Case #${modCase.id}.`);
}

async function handleWarnCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const targetUser = interaction.options.getUser('user', true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const reason = moderationReason(interaction);

  const block = moderationTargetBlock(interaction, targetUser, targetMember, 'warn');
  if (block) {
    await interaction.editReply(block);
    return;
  }

  const modCase = await createModerationCase(interaction, {
    type: 'warn',
    targetUser,
    reason
  });

  await targetUser.send(`You were warned in ${interaction.guild.name}: ${reason}`).catch(() => null);
  await interaction.editReply(`Warned ${targetUser.tag}. Case #${modCase.id}.`);
}

async function handleWarningsCommand(interaction) {
  const targetUser = interaction.options.getUser('user', true);
  const limit = interaction.options.getInteger('limit') ?? 5;
  const warnings = statements.modCases.warningsForUser(targetUser.id, limit);

  if (warnings.length === 0) {
    await interaction.reply({ ephemeral: true, content: `${targetUser.tag} has no stored warnings.` });
    return;
  }

  await interaction.reply({
    ephemeral: true,
    content: [
      `**Warnings for ${targetUser.tag}**`,
      ...warnings.map((row) => `#${row.id} ${row.active ? 'active' : 'cleared'} <t:${Math.floor(row.created_at / 1000)}:R> - ${row.reason}`)
    ].join('\n').slice(0, 1900)
  });
}

async function handleClearWarningCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const caseId = interaction.options.getInteger('case_id', true);
  const reason = moderationReason(interaction);
  const cleared = statements.modCases.clearWarning(caseId, interaction.user.id, reason);

  if (!cleared) {
    await interaction.editReply('No warning case exists with that ID.');
    return;
  }

  audit('moderation.warning_cleared', {
    actorId: interaction.user.id,
    targetId: cleared.target_id,
    data: { caseId, reason }
  });
  await staffAuditLog(interaction.client, 'Moderation warning cleared', [
    { name: 'Case', value: `#${cleared.id}`, inline: true },
    { name: 'Target', value: cleared.target_id ? `<@${cleared.target_id}>` : 'unknown', inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Reason', value: reason }
  ]);
  await interaction.editReply(`Cleared warning case #${cleared.id}.`);
}

async function handleModLogsCommand(interaction) {
  const targetUser = interaction.options.getUser('user', true);
  const limit = interaction.options.getInteger('limit') ?? 5;
  const cases = statements.modCases.forUser(targetUser.id, limit);

  if (cases.length === 0) {
    await interaction.reply({ ephemeral: true, content: `${targetUser.tag} has no stored moderation cases.` });
    return;
  }

  await interaction.reply({
    ephemeral: true,
    content: [
      `**Mod Logs for ${targetUser.tag}**`,
      ...cases.map((row) => `#${row.id} ${row.type} ${row.active ? 'active' : 'closed'} <t:${Math.floor(row.created_at / 1000)}:R> - ${row.reason}`)
    ].join('\n').slice(0, 1900)
  });
}

async function handleCaseCommand(interaction) {
  const caseId = interaction.options.getInteger('case_id', true);
  const modCase = statements.modCases.get(caseId);

  if (!modCase) {
    await interaction.reply({ ephemeral: true, content: 'No moderation case exists with that ID.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Moderation Case #${modCase.id}`)
    .setColor(0xead49f)
    .addFields(
      { name: 'Type', value: modCase.type, inline: true },
      { name: 'Status', value: modCase.active ? 'active' : 'closed', inline: true },
      { name: 'Created', value: `<t:${Math.floor(modCase.created_at / 1000)}:F>`, inline: true },
      { name: 'Staff', value: `<@${modCase.actor_id}>`, inline: true },
      { name: 'Target', value: modCase.target_id ? `<@${modCase.target_id}>` : 'none', inline: true },
      { name: 'Channel', value: modCase.channel_id ? `<#${modCase.channel_id}>` : 'none', inline: true },
      { name: 'Reason', value: modCase.reason }
    );

  if (modCase.duration_ms) {
    embed.addFields({ name: 'Duration', value: formatDuration(modCase.duration_ms), inline: true });
  }
  if (modCase.message_count != null) {
    embed.addFields({ name: 'Messages', value: String(modCase.message_count), inline: true });
  }
  if (modCase.clear_reason) {
    embed.addFields({ name: 'Clear Reason', value: modCase.clear_reason });
  }

  await interaction.reply({ ephemeral: true, embeds: [embed] });
}

async function handleLockCommand(interaction, locked) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const reason = moderationReason(interaction);

  if (!channel || typeof channel.permissionOverwrites?.edit !== 'function') {
    await interaction.editReply('That channel cannot be locked by this command.');
    return;
  }

  await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
    SendMessages: locked ? false : null
  }, { reason: auditReason(interaction, reason) });

  const modCase = await createModerationCase(interaction, {
    type: locked ? 'lock' : 'unlock',
    reason,
    channelId: channel.id
  });

  await interaction.editReply(`${locked ? 'Locked' : 'Unlocked'} <#${channel.id}>. Case #${modCase.id}.`);
}

async function handleSlowmodeCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const seconds = interaction.options.getInteger('seconds', true);
  const reason = moderationReason(interaction);

  if (!channel || typeof channel.setRateLimitPerUser !== 'function') {
    await interaction.editReply('That channel does not support slowmode.');
    return;
  }

  await channel.setRateLimitPerUser(seconds, auditReason(interaction, reason));
  const modCase = await createModerationCase(interaction, {
    type: 'slowmode',
    reason,
    channelId: channel.id,
    durationMs: seconds * 1000,
    metadata: { seconds }
  });

  await interaction.editReply(`Set slowmode in <#${channel.id}> to ${seconds}s. Case #${modCase.id}.`);
}

async function handleUserInfoCommand(interaction) {
  const user = interaction.options.getUser('user') ?? interaction.user;
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
  const cases = statements.modCases.forUser(user.id, 5);
  const embed = new EmbedBuilder()
    .setTitle(`User Info: ${user.tag}`)
    .setColor(0xead49f)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'User', value: `<@${user.id}>`, inline: true },
      { name: 'ID', value: user.id, inline: true },
      { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Joined', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Not in guild', inline: true },
      { name: 'Top Role', value: member?.roles?.highest ? `<@&${member.roles.highest.id}>` : 'None', inline: true },
      { name: 'Stored Cases', value: String(cases.length), inline: true }
    )
    .setTimestamp(new Date());

  if (cases.length > 0) {
    embed.addFields({
      name: 'Recent Cases',
      value: cases.map((row) => `#${row.id} ${row.type} - ${row.reason}`).join('\n').slice(0, 1024)
    });
  }

  await interaction.reply({ ephemeral: true, embeds: [embed] });
}

async function handleSupportCommand(interaction) {
  await interaction.reply({
    ephemeral: true,
    content: [
      '**SHD Support**',
      config.websites.supportSite ? `Support site: ${config.websites.supportSite}` : 'Use the ticket panel to open a support ticket.',
      'If you already opened a website form, paste the generated support key inside your ticket thread.',
      config.websites.publicSite ? `Website: ${config.websites.publicSite}` : null
    ].filter(Boolean).join('\n')
  });
}

async function createModerationCase(interaction, values) {
  const targetUser = values.targetUser ?? null;
  const modCase = statements.modCases.create({
    type: values.type,
    actorId: interaction.user.id,
    targetId: values.targetId ?? targetUser?.id ?? null,
    targetTag: targetUser?.tag ?? null,
    guildId: interaction.guildId,
    channelId: values.channelId ?? interaction.channelId,
    reason: values.reason,
    durationMs: values.durationMs ?? null,
    messageCount: values.messageCount ?? null,
    metadata: values.metadata ?? {},
    active: values.active ?? true
  });

  audit(`moderation.${values.type}`, {
    actorId: interaction.user.id,
    targetId: modCase.target_id,
    data: { caseId: modCase.id, reason: modCase.reason, channelId: modCase.channel_id }
  });
  await staffAuditLog(interaction.client, `Moderation ${values.type}`, [
    { name: 'Case', value: `#${modCase.id}`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Target', value: modCase.target_id ? `<@${modCase.target_id}>` : 'none', inline: true },
    { name: 'Channel', value: modCase.channel_id ? `<#${modCase.channel_id}>` : 'none', inline: true },
    { name: 'Duration', value: modCase.duration_ms ? formatDuration(modCase.duration_ms) : null, inline: true },
    { name: 'Messages', value: modCase.message_count == null ? null : String(modCase.message_count), inline: true },
    { name: 'Reason', value: modCase.reason }
  ]);
  return modCase;
}

function moderationTargetBlock(interaction, targetUser, targetMember, action) {
  if (targetUser.id === interaction.user.id) return `You cannot ${action} yourself.`;
  if (targetUser.id === interaction.client.user?.id) return `I cannot ${action} myself.`;
  if (!targetMember) return null;
  if (targetMember.id === interaction.guild.ownerId) return `You cannot ${action} the server owner.`;
  if (interaction.member?.roles?.highest && targetMember.roles.highest.comparePositionTo(interaction.member.roles.highest) >= 0) {
    return `You cannot ${action} a member with an equal or higher top role.`;
  }
  return null;
}

function moderationReason(interaction) {
  return interaction.options.getString('reason')?.trim() || 'No reason provided.';
}

function auditReason(interaction, reason) {
  return `${reason} | Staff: ${interaction.user.tag} (${interaction.user.id})`;
}

function parseDurationMs(value) {
  const match = String(value ?? '').trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d|w)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return Number.isFinite(amount) && amount > 0 ? amount * multipliers[unit] : null;
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds % 604800 === 0) return `${seconds / 604800}w`;
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

async function handleSite(interaction) {
  if (!hasStaffAccess(interaction)) {
    await interaction.reply({ ephemeral: true, content: missingPermissionMessage('control website content') });
    return;
  }
  if (!siteConfigured()) {
    await interaction.reply({
      ephemeral: true,
      content: 'SHD site internal API is not configured. Set SHD_SITE_INTERNAL_API_BASE_URL and SHD_SITE_INTERNAL_TOKEN.'
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();

  try {
    const response = await runSiteCommand(interaction, subcommand);
    audit('site.command', {
      actorId: interaction.user.id,
      data: { subcommand, action: response.action ?? 'status', persisted: response.persisted ?? null }
    });
    await interaction.editReply(siteCommandReply(response));
  } catch (error) {
    audit('site.command_error', {
      actorId: interaction.user.id,
      data: { subcommand, error: error.message }
    });
    await interaction.editReply(`Website API request failed: ${error.message}`);
  }
}

async function runSiteCommand(interaction, subcommand) {
  if (subcommand === 'status') {
    return siteGet('/status');
  }
  if (subcommand === 'list') {
    const type = interaction.options.getString('type') ?? 'summary';
    const limit = interaction.options.getInteger('limit') ?? 8;
    return siteGet(`/content?type=${encodeURIComponent(type)}&limit=${limit}`);
  }
  if (subcommand === 'announce') {
    return sitePost('/announcements', {
      title: interaction.options.getString('title', true),
      body: interaction.options.getString('body', true),
      kind: interaction.options.getString('kind') ?? 'site'
    }, interaction.user.id);
  }
  if (subcommand === 'match') {
    return sitePost('/matches', {
      opponent: interaction.options.getString('opponent', true),
      startsAt: interaction.options.getString('starts_at', true),
      eventType: interaction.options.getString('event_type') ?? 'Premier',
      maps: splitCsv(interaction.options.getString('maps'))
    }, interaction.user.id);
  }
  if (subcommand === 'result') {
    const matchId = interaction.options.getString('match_id', true);
    return sitePost(`/matches/${encodeURIComponent(matchId)}/result`, {
      result: interaction.options.getString('result', true),
      score: interaction.options.getString('score', true),
      reviewNotes: interaction.options.getString('notes') ?? ''
    }, interaction.user.id);
  }
  if (subcommand === 'edit-match') {
    const matchId = interaction.options.getString('match_id', true);
    return sitePatch(`/matches/${encodeURIComponent(matchId)}`, {
      opponent: interaction.options.getString('opponent') ?? '',
      startsAt: interaction.options.getString('starts_at') ?? '',
      eventType: interaction.options.getString('event_type') ?? '',
      maps: splitCsv(interaction.options.getString('maps')),
      reviewNotes: interaction.options.getString('notes') ?? ''
    }, interaction.user.id);
  }
  if (subcommand === 'vod') {
    return sitePost('/vods', {
      matchId: interaction.options.getString('match_id', true),
      vodUrl: interaction.options.getString('url', true)
    }, interaction.user.id);
  }
  if (subcommand === 'clip') {
    return sitePost('/clips', {
      title: interaction.options.getString('title', true),
      player: interaction.options.getString('player', true),
      sourceUrl: interaction.options.getString('url', true),
      map: interaction.options.getString('map') ?? '',
      tags: splitCsv(interaction.options.getString('tags'))
    }, interaction.user.id);
  }
  if (subcommand === 'edit-clip') {
    const clipId = interaction.options.getString('clip_id', true);
    return sitePatch(`/clips/${encodeURIComponent(clipId)}`, {
      title: interaction.options.getString('title') ?? '',
      player: interaction.options.getString('player') ?? '',
      sourceUrl: interaction.options.getString('url') ?? '',
      map: interaction.options.getString('map') ?? '',
      tags: splitCsv(interaction.options.getString('tags'))
    }, interaction.user.id);
  }
  if (subcommand === 'edit-announce') {
    const announcementId = interaction.options.getString('announcement_id', true);
    return sitePatch(`/announcements/${encodeURIComponent(announcementId)}`, {
      title: interaction.options.getString('title') ?? '',
      body: interaction.options.getString('body') ?? '',
      kind: interaction.options.getString('kind') ?? ''
    }, interaction.user.id);
  }
  if (subcommand === 'roster') {
    return sitePost('/roster', {
      displayName: interaction.options.getString('name', true),
      riotId: interaction.options.getString('riot_id', true),
      peak: interaction.options.getString('peak') ?? '',
      agents: splitCsv(interaction.options.getString('agents')),
      status: interaction.options.getString('status') ?? 'main'
    }, interaction.user.id);
  }
  if (subcommand === 'record') {
    return sitePost('/premier-record', {
      wins: interaction.options.getInteger('wins', true),
      losses: interaction.options.getInteger('losses', true),
      seasonLabel: interaction.options.getString('season') ?? 'Premier Stage'
    }, interaction.user.id);
  }
  if (subcommand === 'delete') {
    const type = interaction.options.getString('type', true);
    const id = interaction.options.getString('id', true);
    return siteDelete(`/${deletePathForType(type)}/${encodeURIComponent(id)}`, interaction.user.id);
  }
  throw new Error(`Unsupported site subcommand: ${subcommand}`);
}

function deletePathForType(type) {
  if (type === 'match') return 'matches';
  if (type === 'clip') return 'clips';
  if (type === 'announcement') return 'announcements';
  return 'roster';
}

function splitCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function siteCommandReply(response) {
  if (response.content) return siteContentReply(response.content);

  const details = siteResponseDetails(response);
  return [
    '**SHD Site Control**',
    `Status: ${response.ok ? 'saved' : 'failed'}`,
    `Action: ${response.action ?? 'status'}`,
    `Storage: ${response.persisted ? 'SQLite' : response.mode ?? 'live'}`,
    response.storage ? `Backend: ${response.storage}` : null,
    response.message ? `Message: ${response.message}` : null,
    details.length ? '' : null,
    ...details
  ].filter(Boolean).join('\n').slice(0, 1900);
}

function siteResponseDetails(response) {
  if (response.announcement) {
    return [
      `Announcement ID: \`${response.announcement.id}\``,
      `Title: ${response.announcement.title}`,
      `Kind: ${response.announcement.kind}`
    ];
  }
  if (response.match) {
    return [
      `Match ID: \`${response.match.id}\``,
      `Opponent: ${response.match.opponent}`,
      `Status: ${response.match.status}`,
      `Score: ${response.match.score}`,
      `Maps: ${listOrFallback(response.match.maps, 'TBD')}`
    ];
  }
  if (response.clip) {
    return [
      `Clip ID: \`${response.clip.id}\``,
      `Title: ${response.clip.title}`,
      `Player: ${response.clip.player}`,
      `Tags: ${listOrFallback(response.clip.tags, 'none')}`
    ];
  }
  if (response.member) {
    return [
      `Member ID: \`${response.member.id}\``,
      `Name: ${response.member.displayName}`,
      `Riot ID: ${response.member.riotId}`,
      `Rank row: #${response.member.rank}`
    ];
  }
  if (response.stats) {
    return [
      `Season: ${response.stats.seasonLabel}`,
      `Record: ${response.stats.wins}-${response.stats.losses}`
    ];
  }
  if (response.deletion) {
    return [
      `Deleted: ${response.deletion.removed ? 'yes' : 'no'}`,
      `Type: ${response.deletion.type}`,
      `ID: \`${response.deletion.id}\``,
      `Rows removed: ${response.deletion.deleted}`
    ];
  }
  if (Array.isArray(response.capabilities)) {
    return [`Capabilities: ${response.capabilities.join(', ')}`];
  }
  return [];
}

function siteContentReply(content) {
  const lines = [
    `**SHD Site ${titleCase(content.type)}**`,
    content.counts ? `Counts: ${Object.entries(content.counts).map(([key, value]) => `${key} ${value}`).join(' | ')}` : null,
    ''
  ].filter(Boolean);

  if (content.type === 'matches') {
    lines.push(...content.matches.map((match) => `\`${match.id}\` ${match.status} ${match.opponent} | ${match.score} | ${listOrFallback(match.maps, 'TBD')}`));
  } else if (content.type === 'roster') {
    lines.push(...content.members.map((member) => `#${member.rank} \`${member.id}\` ${member.displayName} | ${member.riotId} | ${member.peak}`));
  } else if (content.type === 'clips') {
    lines.push(...content.clips.map((clip) => `\`${clip.id}\` ${clip.title} | ${clip.player} | ${clip.map}`));
  } else if (content.type === 'announcements') {
    lines.push(...content.announcements.map((item) => `\`${item.id}\` ${item.kind} | ${item.title}`));
  } else if (content.type === 'audit') {
    lines.push(...content.auditEvents.map((event) => `#${event.id} ${event.type} <t:${Math.floor(event.createdAt / 1000)}:R>`));
  } else if (content.latest) {
    lines.push(
      content.latest.match ? `Latest match: \`${content.latest.match.id}\` ${content.latest.match.opponent}` : 'Latest match: none',
      content.latest.clip ? `Latest clip: \`${content.latest.clip.id}\` ${content.latest.clip.title}` : 'Latest clip: none',
      content.latest.announcement ? `Latest announcement: \`${content.latest.announcement.id}\` ${content.latest.announcement.title}` : 'Latest announcement: none',
      content.latest.auditEvent ? `Latest audit: #${content.latest.auditEvent.id} ${content.latest.auditEvent.type}` : 'Latest audit: none'
    );
  }

  if (lines.length <= 3) lines.push('No rows found.');
  return lines.join('\n').slice(0, 1900);
}

function listOrFallback(value, fallback) {
  return Array.isArray(value) && value.length ? value.join(', ') : fallback;
}

function titleCase(value) {
  return String(value ?? 'summary').replace(/^\w/, (letter) => letter.toUpperCase());
}
