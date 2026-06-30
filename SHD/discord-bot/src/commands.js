import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit } from './logger.js';
import { hasStaffAccess, missingPermissionMessage } from './permissions.js';
import { handleVerifyPanelCommand, handleRolePanelCommand } from './panels.js';
import { siteConfigured, siteGet, sitePost } from './site-client.js';
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
  );

export const commands = [
  statusCommand.toJSON(),
  auditCommand.toJSON(),
  panelCommand.toJSON(),
  setupCommand.toJSON(),
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
    check('support ping role configured', Boolean(config.roles.supportPing), 'warn')
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
  if (subcommand === 'clip') {
    return sitePost('/clips', {
      title: interaction.options.getString('title', true),
      player: interaction.options.getString('player', true),
      sourceUrl: interaction.options.getString('url', true),
      map: interaction.options.getString('map') ?? '',
      tags: splitCsv(interaction.options.getString('tags'))
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
  throw new Error(`Unsupported site subcommand: ${subcommand}`);
}

function splitCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function siteCommandReply(response) {
  return [
    '**SHD Site API**',
    `ok: ${response.ok ? 'yes' : 'no'}`,
    `action: ${response.action ?? 'status'}`,
    `mode: ${response.mode ?? 'live'}`,
    `persisted: ${response.persisted ? 'yes' : 'no'}`,
    response.message ? `message: ${response.message}` : null
  ].filter(Boolean).join('\n').slice(0, 1900);
}
