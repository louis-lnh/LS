import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} from 'discord.js';
import { assertRuntimeConfig, config } from './config.js';
import { statements } from './db.js';
import { appealLog, modLog, audit, securityLog, staffAuditLog } from './logger.js';
import { minecraftBan, minecraftKick, resolveMinecraftProfile, whitelistAdd, whitelistRemove } from './minecraft.js';
import { calculateRisk, formatRiskReasons, refreshRisk } from './risk.js';
import { currentRulesVersion, setRulesVersion } from './settings.js';
import { handleRulesPanelCommand, handleRulesPanelInteraction } from './rule-panels.js';
import { handleRolePanelCommand, handleRolePanelInteraction } from './role-panel.js';
import { handlePanelCommand, handleTicketInteraction, handleTicketMessage } from './tickets.js';
import { hasSensitiveDataAccess, hasStaffAccess, hasStaffOrPermission, missingPermissionMessage } from './permissions.js';
import { createVerification } from './verification.js';
import { startWebServer } from './web.js';

assertRuntimeConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const staffCommands = new Set([
  'whois',
  'risk',
  'risklist',
  'panel',
  'whoisid',
  'confirm',
  'discord-rules-panel',
  'lifesteal-rules-panel',
  'lifesteal-roles-panel',
  'alts',
  'history',
  'note',
  'case',
  'flag',
  'purge',
  'approve',
  'deny',
  'sharedip',
  'kick',
  'ban',
  'unlink',
  'notification',
  'notification-publish',
  'data'
]);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  startWebServer(client);
  startSolvedTicketAutoArchive(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (await handleRolePanelInteraction(interaction)) return;
    if (await handleRulesPanelInteraction(interaction)) return;
  } catch (error) {
    console.error(error);
    const payload = { content: `Error: ${error.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
    return;
  }

  try {
    if (await handleTicketInteraction(interaction)) return;
  } catch (error) {
    console.error(error);
    const payload = { content: `Error: ${error.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
    return;
  }

  if (interaction.isAutocomplete()) {
    try {
      await handleApplicationAutocomplete(interaction);
    } catch (error) {
      console.error(error);
      await interaction.respond([]).catch(() => null);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    recordDiscordSnapshot(interaction.user);
    if (staffCommands.has(interaction.commandName) && !hasCommandAccess(interaction)) {
      return interaction.reply({ content: 'You do not have permission to use this staff command.', ephemeral: true });
    }

    switch (interaction.commandName) {
      case 'verify':
        await handleVerify(interaction);
        break;
      case 'whois':
        await handleWhois(interaction);
        break;
      case 'risk':
        await handleRisk(interaction);
        break;
      case 'risklist':
        await handleRiskList(interaction);
        break;
      case 'signup':
        await handleSignup(interaction);
        break;
      case 'rules':
        await handleRules(interaction);
        break;
      case 'profile':
        await handleProfile(interaction);
        break;
      case 'panel':
        await handlePanelCommand(interaction);
        break;
      case 'whatsmyid':
        await handleWhatsMyId(interaction);
        break;
      case 'whoisid':
        await handleWhoisId(interaction);
        break;
      case 'confirm':
        await handleConfirmTicket(interaction);
        break;
      case 'discord-rules-panel':
        await handleRulesPanelCommand(interaction, 'discord');
        break;
      case 'lifesteal-rules-panel':
        await handleRulesPanelCommand(interaction, 'lifesteal');
        break;
      case 'lifesteal-roles-panel':
        await handleRolePanelCommand(interaction);
        break;
      case 'appeal':
        await handleAppeal(interaction);
        break;
      case 'alts':
        await handleAlts(interaction);
        break;
      case 'history':
        await handleHistory(interaction);
        break;
      case 'note':
        await handleNote(interaction);
        break;
      case 'approve':
        await handleApprove(interaction);
        break;
      case 'deny':
        await handleDeny(interaction);
        break;
      case 'sharedip':
        await handleSharedIp(interaction);
        break;
      case 'case':
        await handleCase(interaction);
        break;
      case 'flag':
        await handleFlag(interaction);
        break;
      case 'purge':
        await handlePurge(interaction);
        break;
      case 'kick':
        await handleKick(interaction);
        break;
      case 'ban':
        await handleBan(interaction);
        break;
      case 'unlink':
        await handleUnlink(interaction);
        break;
      case 'notification':
        await handleNotification(interaction);
        break;
      case 'notification-publish':
        await handleNotificationPublish(interaction);
        break;
      case 'data':
        await handleData(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    const payload = { content: `Error: ${error.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleTicketMessage(message);
  } catch (error) {
    console.error(error);
    await message.reply(`Error: ${error.message}`).catch(() => null);
  }
});

client.on(Events.ThreadDelete, async (thread) => {
  try {
    const ticket = statements.findTicketByThread.get(thread.id);
    if (!ticket) {
      return;
    }

    statements.closeTicketThread.run(thread.id);
    audit('ticket.thread_deleted', {
      discordId: ticket.discord_id,
      minecraftUuid: ticket.minecraft_uuid,
      data: {
        type: ticket.type,
        threadId: thread.id,
        parentId: thread.parentId ?? ticket.channel_id
      }
    });
    await modLog(client, 'Ticket Thread Deleted', [
      { name: 'Type', value: ticket.type, inline: true },
      { name: 'User', value: `<@${ticket.discord_id}>`, inline: true },
      { name: 'Thread', value: thread.name ?? thread.id, inline: true }
    ]);
  } catch (error) {
    console.error(error);
  }
});

async function handleVerify(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const username = interaction.options.getString('minecraft_name', true);
  const existing = statements.findLinkedByDiscord.get(interaction.user.id);
  if (existing?.status === 'active') {
    return interaction.editReply(`You are already linked to ${existing.minecraft_name}. Ask staff if you need this changed.`);
  }

  const profile = await resolveMinecraftProfile(username);
  recordMinecraftSnapshot(profile);
  const existingMinecraft = statements.findLinkedByMinecraft.get(profile.uuid);
  if (existingMinecraft && existingMinecraft.discord_id !== interaction.user.id) {
    return interaction.editReply('That Minecraft account is already linked to another Discord user. Ask staff if this is wrong.');
  }

  const verification = createVerification(interaction.user.id, profile);
  await interaction.editReply([
    `Open this link to finish linking **${profile.name}**:`,
    verification.url,
    '',
    `When the Fabric bridge is installed, you can instead run this in Minecraft: **/link ${verification.linkCode}**`,
    '',
    'The page records a protected hash of your IP for duplicate-account checks. Raw IPs are not stored by this bot.'
  ].join('\n'));
}

async function handleWhois(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const linked = await linkedFromOptions(interaction);

  if (!linked) return interaction.editReply('No linked account found.');
  const signup = statements.findSignupAnswers.get(linked.discord_id);
  const rules = statements.findRulesAcceptance.get(linked.discord_id);
  const risk = await refreshRisk(client, linked);

  const embed = new EmbedBuilder()
    .setTitle('Linked account')
    .setColor(risk.score >= 80 ? 0xff4d4d : linked.suspicious ? 0xffb020 : 0x35b87f)
    .addFields(
      { name: 'Discord', value: `<@${linked.discord_id}> (${linked.discord_id})`, inline: false },
      { name: 'SHD ID', value: linked.shd_id ?? 'Not assigned', inline: true },
      { name: 'Minecraft', value: `${linked.minecraft_name} (${linked.minecraft_uuid})`, inline: false },
      { name: 'Status', value: linked.status, inline: true },
      { name: 'Risk', value: `${risk.score} (${risk.band})`, inline: true },
      { name: 'Rules', value: rules ? `${rules.rules_version} at <t:${Math.floor(rules.accepted_at / 1000)}:f>` : 'Not accepted', inline: false },
      { name: 'Signup', value: signup ? compactSignup(signup) : 'No signup answers', inline: false },
      { name: 'Suspicious', value: linked.suspicious ? linked.suspicious_reason || 'Yes' : 'No', inline: false },
      { name: 'Verified', value: `<t:${Math.floor(linked.verified_at / 1000)}:f>`, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleRisk(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const linked = await linkedFromOptions(interaction);
  if (!linked) return interaction.editReply('No linked account found.');

  const risk = await refreshRisk(client, linked);
  const roleResult = await syncSuspiciousRole(interaction.guild, linked.discord_id, risk, client, {
    minecraftUuid: linked.minecraft_uuid,
    source: 'risk_command'
  });
  const embed = new EmbedBuilder()
    .setTitle('Risk score')
    .setColor(risk.score >= 80 ? 0xff4d4d : risk.score >= 50 ? 0xffb020 : 0x35b87f)
    .addFields([
      { name: 'Account', value: `<@${linked.discord_id}> / ${linked.minecraft_name}`, inline: false },
      { name: 'Score', value: `${risk.score}`, inline: true },
      { name: 'Band', value: risk.band, inline: true },
      roleResult.ok ? null : { name: 'Role Sync Warning', value: roleResult.error, inline: false },
      { name: 'Reasons', value: formatRiskReasons(risk.reasons).slice(0, 1024), inline: false }
    ].filter(Boolean));
  await interaction.editReply({ embeds: [embed] });
}

async function handleRiskList(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const threshold = interaction.options.getInteger('threshold', true);
  const rows = [];
  for (const linked of statements.findLinkedAccounts.all()) {
    const risk = await refreshRisk(client, linked);
    if (risk.score >= threshold) {
      rows.push({ linked, risk });
    }
  }

  rows.sort((a, b) => b.risk.score - a.risk.score);
  const description = rows.slice(0, 20)
    .map(({ linked, risk }) => `**${risk.score} ${risk.band}** - <@${linked.discord_id}> / ${linked.minecraft_name}`)
    .join('\n') || 'No linked accounts at or above that threshold.';

  await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`Risk list >= ${threshold}`).setColor(0xffb020).setDescription(description)] });
}

async function handleSignup(interaction) {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });
  if (subcommand === 'submit') {
    const linked = statements.findLinkedByDiscord.get(interaction.user.id);
    const minecraftName = interaction.options.getString('minecraft_name') ?? linked?.minecraft_name ?? null;
    let minecraftUuid = linked?.minecraft_uuid ?? null;
    if (!minecraftUuid && minecraftName) {
      const profile = await resolveMinecraftProfile(minecraftName);
      minecraftUuid = profile.uuid;
    }

    statements.upsertSignupAnswers.run({
      discordId: interaction.user.id,
      minecraftUuid,
      minecraftName,
      lifestealExperience: interaction.options.getString('experience') ?? '',
      foundServer: interaction.options.getString('found_server') ?? '',
      timezone: interaction.options.getString('timezone') ?? '',
      understandsPvp: interaction.options.getBoolean('understands_pvp') ?? false,
      rulesAgreement: interaction.options.getBoolean('agree_rules') ?? false,
      extra: interaction.options.getString('extra') ?? '',
      submittedAt: Date.now()
    });
    audit('signup.submitted', { discordId: interaction.user.id, minecraftUuid, data: { minecraftName } });
    return interaction.editReply('Signup answers saved.');
  }

  const target = interaction.options.getUser('user') ?? interaction.user;
  if (target.id !== interaction.user.id && !hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to view another member signup.');
  }
  const signup = statements.findSignupAnswers.get(target.id);
  await interaction.editReply(signup ? compactSignup(signup) : 'No signup answers found.');
}

async function handleRules(interaction) {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });
  if (subcommand === 'version') {
    return interaction.editReply(`Current rules version: ${currentRulesVersion()}`);
  }
  if (subcommand === 'accept') {
    const linked = statements.findLinkedByDiscord.get(interaction.user.id);
    statements.upsertRulesAcceptance.run({
      discordId: interaction.user.id,
      minecraftUuid: linked?.minecraft_uuid ?? null,
      rulesVersion: currentRulesVersion(),
      acceptedAt: Date.now(),
      source: 'discord_command'
    });
    audit('rules.accepted', { discordId: interaction.user.id, minecraftUuid: linked?.minecraft_uuid ?? null, data: { version: currentRulesVersion() } });
    return interaction.editReply(`Rules accepted for version ${currentRulesVersion()}.`);
  }
  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to bump rules.');
  }
  const version = interaction.options.getString('version', true);
  setRulesVersion(version);
  audit('rules.bumped', { discordId: interaction.user.id, data: { version } });
  await interaction.editReply(`Rules version bumped to ${version}. Existing users must accept again before joining.`);
}

async function handleProfile(interaction) {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });

  if (subcommand === 'set') {
    const linked = statements.findLinkedByDiscord.get(interaction.user.id);
    if (!linked) return interaction.editReply('You need to verify first.');
    const updated = statements.updateProfile.run({
      discordId: interaction.user.id,
      region: interaction.options.getString('region'),
      teamName: interaction.options.getString('team'),
      eventInterest: interaction.options.getString('event_interest'),
      publicStatsOptIn: interaction.options.getBoolean('public_stats')
    });
    audit('profile.updated', { discordId: interaction.user.id, minecraftUuid: linked.minecraft_uuid, data: profileSummary(updated) });
    return interaction.editReply('Profile updated.');
  }

  const target = interaction.options.getUser('user') ?? interaction.user;
  if (target.id !== interaction.user.id && !hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to view another member profile.');
  }
  const linked = statements.findLinkedByDiscord.get(target.id);
  if (!linked) return interaction.editReply('No linked account found.');
  await interaction.editReply(profileSummary(linked));
}

async function handleWhatsMyId(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const linked = statements.findLinkedByDiscord.get(interaction.user.id);
  const identity = statements.findLifestealIdentityByDiscord.get(interaction.user.id);
  const shdId = linked?.shd_id ?? identity?.id ?? null;
  if (!shdId) {
    return interaction.editReply('You do not have an SHD Lifesteal ID yet. Open a Lifesteal ticket first.');
  }

  return interaction.editReply([
    `Your SHD Lifesteal ID is **${shdId}**.`,
    linked ? `Minecraft: **${linked.minecraft_name}**` : 'Minecraft: not confirmed yet'
  ].join('\n'));
}

async function handleWhoisId(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const shdId = normalizeShdId(interaction.options.getString('id', true));
  const identity = statements.findLifestealIdentityByShdId.get(shdId);
  const linked = statements.findLinkedByShdId.get(shdId);
  if (!identity && !linked) {
    return interaction.editReply(`No Lifesteal identity found for ${shdId}.`);
  }

  const discordId = linked?.discord_id ?? identity?.discord_id ?? null;
  const embed = new EmbedBuilder()
    .setTitle(`SHD Identity ${shdId}`)
    .setColor(linked?.status === 'active' ? 0x35b87f : 0xffb020)
    .addFields(
      { name: 'Discord', value: discordId ? `<@${discordId}> (${discordId})` : 'Not linked', inline: false },
      { name: 'Minecraft', value: `${linked?.minecraft_name ?? identity?.minecraft_name ?? 'Unknown'} (${linked?.minecraft_uuid ?? identity?.minecraft_uuid ?? 'no uuid'})`, inline: false },
      { name: 'Status', value: linked?.status ?? 'identity only', inline: true },
      { name: 'Public Stats', value: linked?.public_stats_opt_in ? 'Enabled' : 'Disabled or not linked', inline: true },
      { name: 'Risk', value: linked ? `${linked.risk_score ?? 0} (${linked.risk_band ?? 'low'})` : 'Not linked', inline: true }
    );
  return interaction.editReply({ embeds: [embed] });
}

async function handleConfirmTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.channel?.isThread?.()) {
    return interaction.editReply('Use `/confirm` inside a Lifesteal join ticket thread.');
  }

  const ticket = statements.findTicketByThread.get(interaction.channel.id);
  if (!ticket) {
    return interaction.editReply('No open ticket record found for this thread.');
  }
  if (ticket.type !== 'lifesteal_join') {
    return interaction.editReply('Only Lifesteal join tickets can be confirmed with this command.');
  }
  if (!ticket.discord_id || !ticket.minecraft_uuid || !ticket.minecraft_name) {
    return interaction.editReply('This ticket is missing Discord or Minecraft identity data.');
  }

  const now = Date.now();
  const member = await interaction.guild.members.fetch(ticket.discord_id).catch(() => null);
  const identity = statements.ensureLifestealIdentity.run({
    discordId: ticket.discord_id,
    minecraftUuid: ticket.minecraft_uuid,
    minecraftName: ticket.minecraft_name,
    createdAt: now
  });

  statements.upsertLinked.run({
    discordId: ticket.discord_id,
    shdId: identity.id,
    minecraftUuid: ticket.minecraft_uuid,
    minecraftName: ticket.minecraft_name,
    discordUsername: member?.user.tag ?? null,
    verifiedAt: now,
    lastSeenAt: now,
    status: 'active',
    suspicious: 0,
    suspiciousReason: `Confirmed from ticket ${ticket.thread_id}`,
    riskScore: 0,
    riskBand: 'low',
    riskReasons: [],
    publicStatsOptIn: true,
    rosterStatusUpdatedAt: now
  });
  statements.upsertRulesAcceptance.run({
    discordId: ticket.discord_id,
    minecraftUuid: ticket.minecraft_uuid,
    rulesVersion: currentRulesVersion(),
    acceptedAt: now,
    source: 'ticket_confirm'
  });
  statements.updateTicketThread.run({
    threadId: ticket.thread_id,
    answers: {
      ...(ticket.answers ?? {}),
      confirmedAt: now,
      solvedAt: now,
      autoCloseAt: now + 12 * 60 * 60 * 1000,
      confirmedBy: interaction.user.id,
      confirmation: 'lifesteal_join'
    }
  });

  const whitelistResult = await optionalSideEffect(client, {
    type: 'minecraft.whitelist_add',
    action: 'Add confirmed Lifesteal applicant to Minecraft whitelist',
    discordId: ticket.discord_id,
    minecraftUuid: ticket.minecraft_uuid,
    fields: [
      { name: 'SHD ID', value: identity.id, inline: true },
      { name: 'Applicant', value: `<@${ticket.discord_id}>`, inline: true },
      { name: 'Minecraft', value: ticket.minecraft_name, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
    ],
    run: () => whitelistAdd(ticket.minecraft_name)
  });

  addCase('lifesteal_ticket_confirm', ticket.discord_id, ticket.minecraft_uuid, interaction.user.id, `Confirmed ${identity.id} from ticket`);
  audit('ticket.lifesteal_join_confirmed', {
    discordId: ticket.discord_id,
    minecraftUuid: ticket.minecraft_uuid,
    data: {
      shdId: identity.id,
      threadId: ticket.thread_id,
      moderatorId: interaction.user.id,
      whitelistOk: whitelistResult.ok
    }
  });
  await staffAuditLog(client, 'Lifesteal Ticket Confirmed', [
    { name: 'SHD ID', value: identity.id, inline: true },
    { name: 'Applicant', value: `<@${ticket.discord_id}>`, inline: true },
    { name: 'Minecraft', value: ticket.minecraft_name, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error }
  ].filter(Boolean));
  await modLog(client, 'Lifesteal Ticket Confirmed', [
    { name: 'SHD ID', value: identity.id, inline: true },
    { name: 'Applicant', value: `<@${ticket.discord_id}>`, inline: true },
    { name: 'Minecraft', value: ticket.minecraft_name, inline: true },
    whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error }
  ].filter(Boolean));

  await interaction.channel.send([
    `<@${ticket.discord_id}> your Lifesteal signup was confirmed.`,
    `SHD ID: **${identity.id}**`,
    `Minecraft: **${ticket.minecraft_name}**`,
    whitelistResult.ok ? 'Minecraft access is prepared.' : 'Staff will finish Minecraft access manually if needed.',
    'This ticket will automatically close after 12 hours.'
  ].join('\n')).catch(() => null);

  return interaction.editReply(whitelistResult.ok
    ? `Confirmed ${identity.id}, linked ${ticket.minecraft_name}, enabled public stats, and prepared whitelist access.`
    : `Confirmed ${identity.id}, linked ${ticket.minecraft_name}, and enabled public stats. Whitelist warning: ${whitelistResult.error}`);
}

async function handleAppeal(interaction) {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });
  if (subcommand === 'create') {
    const linked = statements.findLinkedByDiscord.get(interaction.user.id);
    const appeal = statements.createAppeal.run({
      discordId: interaction.user.id,
      minecraftUuid: linked?.minecraft_uuid ?? null,
      reason: interaction.options.getString('reason', true),
      createdAt: Date.now()
    });
    addCase('appeal', interaction.user.id, linked?.minecraft_uuid ?? null, interaction.user.id, `Appeal #${appeal.id} created`);
    audit('appeal.created', { discordId: interaction.user.id, minecraftUuid: linked?.minecraft_uuid ?? null, data: { appealId: appeal.id } });
    await appealLog(client, 'Appeal Created', [
      { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Minecraft', value: linked?.minecraft_name ?? 'Not linked', inline: true },
      { name: 'Appeal', value: `#${appeal.id}`, inline: true }
    ]);
    return interaction.editReply(`Appeal #${appeal.id} created. The panel flow in #appeal-tickets is preferred because it creates a staff thread.`);
  }

  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to manage appeals.');
  }
  const appealId = interaction.options.getInteger('id', true);
  const status = subcommand === 'accept' ? 'accepted' : subcommand === 'deny' ? 'denied' : 'closed';
  const reason = interaction.options.getString('reason') || `${status} by staff`;
  const appeal = statements.updateAppeal.run({ appealId, status, closedAt: Date.now(), closedBy: interaction.user.id, reason });
  if (!appeal) return interaction.editReply('Appeal not found.');
  addCase(`appeal_${status}`, appeal.discord_id, appeal.minecraft_uuid, interaction.user.id, reason);
  audit(`appeal.${status}`, { discordId: appeal.discord_id, minecraftUuid: appeal.minecraft_uuid, data: { appealId, reason } });
  await appealLog(client, `Appeal ${status}`, [
    { name: 'Appeal', value: `#${appealId}`, inline: true },
    { name: 'Target', value: `<@${appeal.discord_id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Reason', value: reason }
  ]);
  await interaction.editReply(`Appeal #${appealId} ${status}.`);
}

async function handleAlts(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const iphash = interaction.options.getString('iphash');
  let linked = iphash ? null : await linkedFromOptions(interaction);
  if (!linked && !iphash) return interaction.editReply('No linked account found.');

  const fullMatches = iphash
    ? statements.findLinkedByIpAny.all(iphash)
    : linked.ip_hash ? statements.findLinkedByIpAny.all(linked.ip_hash) : [];
  const prefixMatches = linked?.ip_prefix_hash ? statements.findLinkedByPrefixAny.all(linked.ip_prefix_hash) : [];
  const history = linked ? statements.findMinecraftHistory.all(linked.minecraft_uuid) : [];

  const embed = new EmbedBuilder()
    .setTitle('Alt investigation')
    .setColor(0xffb020)
    .addFields(
      { name: 'Full IP hash matches', value: formatLinkedList(fullMatches), inline: false },
      { name: 'Prefix hash matches', value: formatLinkedList(prefixMatches), inline: false },
      { name: 'Minecraft UUID history', value: history.map((row) => `<@${row.discord_id}> at <t:${Math.floor(row.linked_at / 1000)}:f>`).join('\n') || 'None', inline: false }
    );
  await interaction.editReply({ embeds: [embed] });
}

async function handleHistory(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const linked = await linkedFromOptions(interaction);
  if (!linked) return interaction.editReply('No linked account found.');
  const timeline = buildTimeline(linked).slice(-20);
  const description = timeline.map((item) => `<t:${Math.floor(item.at / 1000)}:f> **${item.type}** - ${item.text}`).join('\n') || 'No history.';
  await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`History: ${linked.minecraft_name}`).setColor(0x2f7d67).setDescription(description.slice(0, 4096))] });
}

async function handleNote(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'delete') {
    const noteId = interaction.options.getInteger('id', true);
    const deleted = statements.deleteStaffNote.run(noteId);
    if (!deleted) return interaction.editReply('Note not found.');
    audit('staff.note_deleted', {
      discordId: deleted.discord_id,
      minecraftUuid: deleted.minecraft_uuid,
      data: { noteId, moderatorId: interaction.user.id }
    });
    await modLog(client, 'Staff Note Deleted', [
      { name: 'Target', value: `<@${deleted.discord_id}>`, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Note', value: `#${noteId}`, inline: true }
    ]);
    return interaction.editReply(`Deleted note #${noteId}.`);
  }

  const user = interaction.options.getUser('user', true);
  const linked = statements.findLinkedByDiscord.get(user.id);
  if (!linked) return interaction.editReply('That Discord user is not linked.');

  if (subcommand === 'list') {
    const notes = statements.findNotesForAccount.all(user.id, linked.minecraft_uuid);
    const text = notes.slice(-15)
      .map((note) => `#${note.id} <t:${Math.floor(note.created_at / 1000)}:f> by <@${note.author_id}>: ${note.text}`)
      .join('\n') || 'No notes.';
    return interaction.editReply(text.slice(0, 1900));
  }

  const text = interaction.options.getString('text', true);
  const note = statements.addStaffNote.run({
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    authorId: interaction.user.id,
    text,
    createdAt: Date.now()
  });
  addCase('staff_note', user.id, linked.minecraft_uuid, interaction.user.id, `Note #${note.id}: ${text}`);
  audit('staff.note_added', { discordId: user.id, minecraftUuid: linked.minecraft_uuid, data: { noteId: note.id } });
  await modLog(client, 'Staff Note Added', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Note', value: text }
  ]);
  await interaction.editReply(`Added note #${note.id}.`);
}

async function handleApprove(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const applicationCode = interaction.options.getString('application_code');
  if (applicationCode) {
    return approveSupportApplication(interaction, applicationCode);
  }

  const user = interaction.options.getUser('user');
  if (!user) return interaction.editReply('Choose a linked Discord user or provide an application code.');
  const reason = interaction.options.getString('reason') || 'Approved by staff';
  const linked = statements.findLinkedByDiscord.get(user.id);
  if (!linked) return interaction.editReply('That Discord user is not linked.');

  statements.setLinkedStatus.run({
    discordId: user.id,
    status: 'active',
    suspicious: 0,
    reason,
    rosterStatusUpdatedAt: Date.now()
  });
  const whitelistResult = await optionalSideEffect(client, {
    type: 'minecraft.whitelist_add',
    action: 'Add Minecraft whitelist entry',
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    fields: [
      { name: 'Target', value: `<@${user.id}>`, inline: true },
      { name: 'Minecraft', value: linked.minecraft_name, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
    ],
    run: () => whitelistAdd(linked.minecraft_name)
  });

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  let roleResult = { ok: true };
  if (member && config.suspiciousRoleId) {
    roleResult = await optionalSideEffect(client, {
      type: 'discord.role_remove.suspicious',
      action: 'Remove suspicious Discord role',
      discordId: user.id,
      minecraftUuid: linked.minecraft_uuid,
      fields: [
        { name: 'Target', value: `<@${user.id}>`, inline: true },
        { name: 'Role', value: `<@&${config.suspiciousRoleId}>`, inline: true },
        { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
      ],
      run: () => member.roles.remove(config.suspiciousRoleId, reason)
    });
  }

  addCase('approve', user.id, linked.minecraft_uuid, interaction.user.id, reason);
  audit('moderation.approve', {
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    data: { reason, moderatorId: interaction.user.id, whitelistOk: whitelistResult.ok, suspiciousRoleOk: roleResult.ok }
  });
  await modLog(client, 'Linked Member Approved', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Minecraft', value: linked.minecraft_name, inline: true },
    whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error },
    roleResult.ok ? null : { name: 'Role Warning', value: roleResult.error },
    { name: 'Reason', value: reason }
  ].filter(Boolean));
  const warnings = [
    whitelistResult.ok ? null : `whitelist sync failed: ${whitelistResult.error}`,
    roleResult.ok ? null : `role update failed: ${roleResult.error}`
  ].filter(Boolean);
  await interaction.editReply(`Approved ${user.tag} and set the link active.${warnings.length ? ` Staff warning: ${warnings.join('; ')}.` : ''}`);
}

async function handleApplicationAutocomplete(interaction) {
  if (!['approve', 'deny'].includes(interaction.commandName) || !hasCommandAccess(interaction)) {
    return interaction.respond([]);
  }
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'application_code') {
    return interaction.respond([]);
  }

  const search = String(focused.value ?? '').trim().toLowerCase();
  const choices = statements.findReviewableSupportApplications.all()
    .map((application) => ({
      application,
      ticket: statements.findTicketByThread.get(application.ticket_thread_id)
    }))
    .filter(({ ticket }) => ticket && (!ticket.claimed_by || ticket.claimed_by === interaction.user.id))
    .filter(({ application }) => {
      if (!search) return true;
      return [
        application.code,
        application.minecraft_name,
        application.discord_username
      ].some((value) => String(value ?? '').toLowerCase().includes(search));
    })
    .slice(0, 25)
    .map(({ application, ticket }) => ({
      name: `${application.code} | ${application.minecraft_name} | ${ticket.claimed_by ? 'claimed by you' : 'unclaimed'}`.slice(0, 100),
      value: application.code
    }));

  return interaction.respond(choices);
}

function supportApplicationClaimError(application, staffId) {
  const ticket = statements.findTicketByThread.get(application.ticket_thread_id);
  if (!ticket) {
    return 'The application ticket is no longer open, so it cannot be reviewed.';
  }
  if (!ticket.claimed_by) {
    return `Claim <#${application.ticket_thread_id}> before approving or denying this application.`;
  }
  if (ticket.claimed_by !== staffId) {
    return `This application review is already owned by <@${ticket.claimed_by}>.`;
  }
  return null;
}

async function approveSupportApplication(interaction, codeInput) {
  const code = codeInput.trim().toUpperCase();
  const reason = interaction.options.getString('reason') || 'Application approved by staff';
  const application = statements.findSupportApplicationByCode.get(code);
  if (!application) return interaction.editReply('No support application was found with that code.');
  if (!application.discord_id_verified || !application.ticket_thread_id) {
    return interaction.editReply('That application is not attached to a Discord ticket yet. Ask the applicant to paste their application key in the ticket first.');
  }
  if (!['ticket_verified', 'approved_whitelist_pending'].includes(application.status)) {
    return interaction.editReply(`That application is currently ${application.status} and cannot be approved from this command.`);
  }
  const claimError = supportApplicationClaimError(application, interaction.user.id);
  if (claimError) return interaction.editReply(claimError);

  const profile = await resolveMinecraftProfile(application.minecraft_name);
  const member = await interaction.guild.members.fetch(application.discord_id_verified).catch(() => null);
  const now = Date.now();

  statements.upsertLinked.run({
    discordId: application.discord_id_verified,
    minecraftUuid: profile.uuid,
    minecraftName: profile.name,
    discordUsername: member?.user.tag ?? application.discord_username ?? null,
    ipHash: null,
    ipPrefixHash: null,
    verifiedAt: application.verified_at ?? now,
    lastSeenAt: now,
    status: 'active',
    suspicious: 0,
    suspiciousReason: reason,
    publicStatsOptIn: true,
    rosterStatusUpdatedAt: now
  });
  statements.upsertRulesAcceptance.run({
    discordId: application.discord_id_verified,
    minecraftUuid: profile.uuid,
    rulesVersion: currentRulesVersion(),
    acceptedAt: now,
    source: 'support_application_approval'
  });

  const whitelistResult = await optionalSideEffect(client, {
    type: 'minecraft.whitelist_add',
    action: 'Add Minecraft whitelist entry',
    discordId: application.discord_id_verified,
    minecraftUuid: profile.uuid,
    fields: [
      { name: 'Application', value: `${application.id} / ${application.code}`, inline: true },
      { name: 'Applicant', value: `<@${application.discord_id_verified}>`, inline: true },
      { name: 'Minecraft', value: profile.name, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
    ],
    run: () => whitelistAdd(profile.name)
  });
  const whitelistOk = whitelistResult.ok;
  const whitelistError = whitelistResult.error || '';

  const updatedApplication = statements.updateSupportApplicationStatus.run({
    code,
    status: whitelistOk ? 'approved' : 'approved_whitelist_pending',
    reviewedAt: now,
    reviewedBy: interaction.user.id,
    reason: whitelistOk ? reason : `${reason}; whitelist failed: ${whitelistError}`
  });

  const ticket = await interaction.client.channels.fetch(application.ticket_thread_id).catch(() => null);
  if (ticket?.isTextBased?.()) {
    if (whitelistOk) {
      await ticket.send([
        `<@${application.discord_id_verified}> your application was approved.`,
        `Your Discord account is now linked to **${profile.name}**, public stats are enabled, and your Lifesteal access is prepared.`,
        'Have fun in Lifesteal.'
      ].join('\n')).catch(() => null);
    } else {
      await ticket.send([
        `<@${application.discord_id_verified}> your application was approved, but your Minecraft access is not ready yet.`,
        'Staff has been notified and will finish the remaining whitelist step here.'
      ].join('\n')).catch(() => null);
    }
  }

  addCase('support_application_approve', application.discord_id_verified, profile.uuid, interaction.user.id, reason);
  audit('support.application_approved', {
    discordId: application.discord_id_verified,
    minecraftUuid: profile.uuid,
    data: {
      applicationId: updatedApplication.id,
      applicationCode: updatedApplication.code,
      moderatorId: interaction.user.id,
      publicStatsOptIn: true,
      whitelistOk,
      whitelistError: whitelistError || null
    }
  });
  await modLog(client, whitelistOk ? 'Support Application Approved' : 'Support Application Approved With Whitelist Issue', [
    { name: 'Application', value: `${updatedApplication.id} / ${updatedApplication.code}`, inline: true },
    { name: 'Applicant', value: `<@${application.discord_id_verified}>`, inline: true },
    { name: 'Minecraft', value: profile.name, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Public Stats', value: 'Enabled', inline: true },
    whitelistOk ? null : { name: 'Whitelist Issue', value: whitelistError || 'Unknown error' },
    { name: 'Reason', value: reason }
  ].filter(Boolean));
  await staffAuditLog(client, 'Support Application Approval Applied', [
    { name: 'Application', value: `${updatedApplication.id} / ${updatedApplication.code}`, inline: true },
    { name: 'Applicant', value: `<@${application.discord_id_verified}>`, inline: true },
    { name: 'Minecraft', value: profile.name, inline: true },
    { name: 'Result', value: whitelistOk ? 'Approved and ready' : 'Approved, whitelist pending' }
  ]);

  return interaction.editReply(whitelistOk
    ? `Approved ${updatedApplication.code}; linked ${profile.name}, enabled public stats, and notified the ticket.`
    : `Approved ${updatedApplication.code}, but whitelist sync failed: ${whitelistError || 'unknown error'}. The ticket was notified.`);
}

async function handleDeny(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const applicationCode = interaction.options.getString('application_code');
  if (applicationCode) {
    return denySupportApplication(interaction, applicationCode);
  }

  const user = interaction.options.getUser('user');
  if (!user) return interaction.editReply('Choose a linked Discord user or select an application code.');
  const reason = interaction.options.getString('reason') || 'Denied by staff';
  const linked = statements.findLinkedByDiscord.get(user.id);
  if (!linked) return interaction.editReply('That Discord user is not linked.');
  if (!await confirmAction(interaction, {
    title: 'Confirm Deny',
    body: `Deny ${user.tag} and mark their link banned?`,
    confirmLabel: 'Deny'
  })) return;

  statements.setLinkedStatus.run({
    discordId: user.id,
    status: 'banned',
    suspicious: 1,
    reason
  });
  const whitelistResult = await optionalSideEffect(client, {
    type: 'minecraft.whitelist_remove',
    action: 'Remove Minecraft whitelist entry',
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    fields: [
      { name: 'Target', value: `<@${user.id}>`, inline: true },
      { name: 'Minecraft', value: linked.minecraft_name, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
    ],
    run: () => whitelistRemove(linked.minecraft_name)
  });

  addCase('deny', user.id, linked.minecraft_uuid, interaction.user.id, reason);
  audit('moderation.deny', {
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    data: { reason, moderatorId: interaction.user.id, whitelistOk: whitelistResult.ok }
  });
  await staffAuditLog(client, 'Denied Linked Member', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Minecraft', value: linked.minecraft_name, inline: true },
    whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error },
    { name: 'Reason', value: reason }
  ].filter(Boolean));
  await modLog(client, 'Linked Member Denied', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Minecraft', value: linked.minecraft_name, inline: true },
    whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error },
    { name: 'Reason', value: reason }
  ].filter(Boolean));
  await interaction.editReply(`Denied ${user.tag}; their link is now banned.${whitelistResult.ok ? ' Whitelist removal was applied or RCON is disabled.' : ` Staff warning: whitelist removal failed: ${whitelistResult.error}.`}`);
}

async function denySupportApplication(interaction, codeInput) {
  const code = codeInput.trim().toUpperCase();
  const reason = interaction.options.getString('reason') || 'Application denied by staff';
  const application = statements.findSupportApplicationByCode.get(code);
  if (!application) return interaction.editReply('No support application was found with that code.');
  if (!application.discord_id_verified || !application.ticket_thread_id) {
    return interaction.editReply('That application is not attached to a Discord ticket yet.');
  }
  if (!['ticket_verified', 'approved_whitelist_pending'].includes(application.status)) {
    return interaction.editReply(`That application is currently ${application.status} and cannot be denied from this command.`);
  }
  const claimError = supportApplicationClaimError(application, interaction.user.id);
  if (claimError) return interaction.editReply(claimError);
  if (!await confirmAction(interaction, {
    title: 'Confirm Application Denial',
    body: `Deny ${application.code} for ${application.minecraft_name}?`,
    confirmLabel: 'Deny'
  })) return;

  const now = Date.now();
  const updatedApplication = statements.updateSupportApplicationStatus.run({
    code,
    status: 'denied',
    reviewedAt: now,
    reviewedBy: interaction.user.id,
    reason
  });

  const linked = statements.findLinkedByDiscord.get(application.discord_id_verified);
  const matchingLinked = linked &&
    String(linked.minecraft_name ?? '').trim().toLowerCase() === String(application.minecraft_name).trim().toLowerCase()
    ? linked
    : null;
  let whitelistResult = { ok: true, error: null };
  if (matchingLinked) {
    statements.setLinkedStatus.run({
      discordId: application.discord_id_verified,
      status: 'denied',
      suspicious: 0,
      reason,
      rosterStatusUpdatedAt: now
    });
    statements.updateProfile.run({
      discordId: application.discord_id_verified,
      publicStatsOptIn: false
    });
    whitelistResult = await optionalSideEffect(client, {
      type: 'minecraft.whitelist_remove',
      action: 'Remove denied applicant from Minecraft whitelist',
      discordId: application.discord_id_verified,
      minecraftUuid: matchingLinked.minecraft_uuid,
      fields: [
        { name: 'Application', value: updatedApplication.code, inline: true },
        { name: 'Minecraft', value: matchingLinked.minecraft_name, inline: true },
        { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
      ],
      run: () => whitelistRemove(matchingLinked.minecraft_name)
    });
  }

  const ticket = await interaction.client.channels.fetch(application.ticket_thread_id).catch(() => null);
  if (ticket?.isTextBased?.()) {
    await ticket.send([
      `<@${application.discord_id_verified}> your Lifesteal application was not approved.`,
      `Reason: ${reason}`,
      'You can ask staff in this ticket if you need clarification.'
    ].join('\n')).catch(() => null);
  }

  addCase('support_application_deny', application.discord_id_verified, matchingLinked?.minecraft_uuid ?? null, interaction.user.id, reason);
  audit('support.application_denied', {
    discordId: application.discord_id_verified,
    minecraftUuid: matchingLinked?.minecraft_uuid ?? null,
    data: {
      applicationId: updatedApplication.id,
      applicationCode: updatedApplication.code,
      moderatorId: interaction.user.id,
      rosterCleared: true,
      whitelistOk: whitelistResult.ok
    }
  });
  await staffAuditLog(client, 'Support Application Denied', [
    { name: 'Application', value: `${updatedApplication.id} / ${updatedApplication.code}`, inline: true },
    { name: 'Applicant', value: `<@${application.discord_id_verified}>`, inline: true },
    { name: 'Minecraft', value: application.minecraft_name, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error },
    { name: 'Reason', value: reason }
  ].filter(Boolean));
  await modLog(client, 'Support Application Denied', [
    { name: 'Application', value: `${updatedApplication.id} / ${updatedApplication.code}`, inline: true },
    { name: 'Applicant', value: `<@${application.discord_id_verified}>`, inline: true },
    { name: 'Minecraft', value: application.minecraft_name, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Roster', value: 'Removed', inline: true },
    { name: 'Reason', value: reason }
  ]);

  return interaction.editReply(`Denied ${updatedApplication.code}, removed the applicant from the public roster, and notified the ticket.${whitelistResult.ok ? '' : ` Staff warning: whitelist removal failed: ${whitelistResult.error}.`}`);
}

async function handleSharedIp(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.options.getUser('user', true);

  if (subcommand === 'list') {
    const exceptions = statements.findSharedIpExceptionsForUser.all(user.id);
    const text = exceptions.map((row) => {
      const other = row.discord_id_a === user.id ? row.discord_id_b : row.discord_id_a;
      return `<@${other}> approved by <@${row.approved_by}> at <t:${Math.floor(row.approved_at / 1000)}:f>: ${row.reason}`;
    }).join('\n') || 'No shared-IP exceptions.';
    return interaction.editReply(text.slice(0, 1900));
  }

  const other = interaction.options.getUser('other_user', true);
  if (user.id === other.id) return interaction.editReply('Pick two different users.');
  const reason = interaction.options.getString('reason', true);
  const userLinked = statements.findLinkedByDiscord.get(user.id);
  const otherLinked = statements.findLinkedByDiscord.get(other.id);
  if (!userLinked || !otherLinked) return interaction.editReply('Both users must be linked before approving a shared-IP exception.');

  statements.addSharedIpException.run({
    discordIdA: user.id,
    discordIdB: other.id,
    reason,
    approvedBy: interaction.user.id,
    approvedAt: Date.now()
  });
  await refreshRisk(client, userLinked);
  await refreshRisk(client, otherLinked);

  addCase('shared_ip_approve', user.id, userLinked.minecraft_uuid, interaction.user.id, `With ${other.id}: ${reason}`);
  addCase('shared_ip_approve', other.id, otherLinked.minecraft_uuid, interaction.user.id, `With ${user.id}: ${reason}`);
  audit('shared_ip.approved', {
    discordId: user.id,
    minecraftUuid: userLinked.minecraft_uuid,
    data: { otherDiscordId: other.id, reason, moderatorId: interaction.user.id }
  });
  await modLog(client, 'Shared IP Exception Approved', [
    { name: 'Users', value: `<@${user.id}> and <@${other.id}>`, inline: false },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Reason', value: reason }
  ]);
  await interaction.editReply(`Approved shared-IP exception between ${user.tag} and ${other.tag}.`);
}

async function handleCase(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();
  if (subcommand !== 'close') return interaction.editReply('Unknown case command.');
  const caseId = interaction.options.getInteger('id', true);
  const reason = interaction.options.getString('reason') || 'Closed by staff';
  const closed = statements.closeCase.run({ caseId, closedAt: Date.now(), closedBy: interaction.user.id, reason });
  if (!closed) return interaction.editReply('Case not found.');
  audit('case.closed', { discordId: closed.target_discord_id, minecraftUuid: closed.target_minecraft_uuid, data: { caseId, reason } });
  await modLog(client, 'Case Closed', [
    { name: 'Case', value: `#${caseId}`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Reason', value: reason }
  ]);
  await interaction.editReply(`Closed case #${caseId}.`);
}

async function handleFlag(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const suspicious = interaction.options.getBoolean('suspicious', true);
  const reason = interaction.options.getString('reason') || (suspicious ? 'Manual staff flag' : 'Cleared by staff');

  const linked = statements.findLinkedByDiscord.get(user.id);
  if (!linked) return interaction.editReply('That Discord user is not linked.');

  statements.setLinkedStatus.run({
    discordId: user.id,
    status: suspicious ? 'review' : 'active',
    suspicious: suspicious ? 1 : 0,
    reason
  });

  const guild = interaction.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  let manualRoleResult = { ok: true };
  if (member && config.suspiciousRoleId) {
    manualRoleResult = await optionalSideEffect(client, {
      type: suspicious ? 'discord.role_add.suspicious' : 'discord.role_remove.suspicious',
      action: suspicious ? 'Add suspicious Discord role' : 'Remove suspicious Discord role',
      discordId: user.id,
      minecraftUuid: linked.minecraft_uuid,
      fields: [
        { name: 'Target', value: `<@${user.id}>`, inline: true },
        { name: 'Role', value: `<@&${config.suspiciousRoleId}>`, inline: true },
        { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
      ],
      run: () => suspicious
        ? member.roles.add(config.suspiciousRoleId, reason)
        : member.roles.remove(config.suspiciousRoleId, reason)
    });
  }

  let syncRoleResult = { ok: true };
  const refreshed = statements.findLinkedByDiscord.get(user.id);
  if (refreshed) {
    const risk = await refreshRisk(client, refreshed);
    syncRoleResult = await syncSuspiciousRole(interaction.guild, user.id, risk, client, {
      minecraftUuid: linked.minecraft_uuid,
      source: 'manual_flag'
    });
  }

  addCase('flag', user.id, linked.minecraft_uuid, interaction.user.id, reason);
  audit('moderation.flag', {
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    data: {
      suspicious,
      reason,
      moderatorId: interaction.user.id,
      manualRoleOk: manualRoleResult.ok,
      syncRoleOk: syncRoleResult.ok
    }
  });
  await modLog(client, suspicious ? 'Member Flagged' : 'Member Flag Cleared', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Minecraft', value: linked.minecraft_name, inline: true },
    manualRoleResult.ok ? null : { name: 'Manual Role Warning', value: manualRoleResult.error },
    syncRoleResult.ok ? null : { name: 'Risk Role Warning', value: syncRoleResult.error },
    { name: 'Reason', value: reason }
  ].filter(Boolean));
  await securityLog(client, suspicious ? 'Security Flag Added' : 'Security Flag Cleared', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Minecraft', value: linked.minecraft_name, inline: true },
    manualRoleResult.ok ? null : { name: 'Manual Role Warning', value: manualRoleResult.error },
    syncRoleResult.ok ? null : { name: 'Risk Role Warning', value: syncRoleResult.error },
    { name: 'Reason', value: reason }
  ].filter(Boolean));

  const warnings = [
    manualRoleResult.ok ? null : `manual role update failed: ${manualRoleResult.error}`,
    syncRoleResult.ok ? null : `risk role sync failed: ${syncRoleResult.error}`
  ].filter(Boolean);
  await interaction.editReply(`${suspicious ? 'Flagged' : 'Cleared'} ${user.tag}.${warnings.length ? ` Staff warning: ${warnings.join('; ')}.` : ''}`);
}

async function handlePurge(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasStaffOrPermission(interaction, PermissionFlagsBits.ManageMessages)) {
    return interaction.editReply(missingPermissionMessage('delete messages'));
  }

  const amount = interaction.options.getInteger('amount', true);
  const deleted = await interaction.channel.bulkDelete(amount, true);
  addCase('purge', null, null, interaction.user.id, `Deleted ${deleted.size} messages in #${interaction.channel.name}`);
  audit('moderation.purge', {
    discordId: interaction.user.id,
    data: { channelId: interaction.channel.id, amount: deleted.size }
  });
  await interaction.editReply(`Deleted ${deleted.size} messages.`);
}

async function handleKick(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const includeMinecraft = interaction.options.getBoolean('minecraft') ?? false;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.editReply('That member is not in this server.');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
    return interaction.editReply('You do not have permission to kick members.');
  }

  const linked = statements.findLinkedByDiscord.get(user.id);
  if (!await confirmAction(interaction, {
    title: 'Confirm Kick',
    body: `Kick ${user.tag}${includeMinecraft && linked ? ` and Minecraft account ${linked.minecraft_name}` : ''}?`,
    confirmLabel: 'Kick'
  })) return;

  if (includeMinecraft && linked) await minecraftKick(linked.minecraft_name, reason);
  await member.kick(reason);

  addCase('kick', user.id, linked?.minecraft_uuid ?? null, interaction.user.id, reason);
  audit('moderation.kick', {
    discordId: user.id,
    minecraftUuid: linked?.minecraft_uuid ?? null,
    data: { reason, includeMinecraft, moderatorId: interaction.user.id }
  });
  await modLog(client, 'Member Kicked', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Minecraft', value: linked?.minecraft_name ?? 'Not linked', inline: true },
    { name: 'Reason', value: reason }
  ]);
  await interaction.editReply(`Kicked ${user.tag}.`);
}

async function handleBan(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const includeMinecraft = interaction.options.getBoolean('minecraft') ?? false;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply('You do not have permission to ban members.');
  }

  const linked = statements.findLinkedByDiscord.get(user.id);
  if (!await confirmAction(interaction, {
    title: 'Confirm Ban',
    body: `Ban ${user.tag}${includeMinecraft && linked ? ` and Minecraft account ${linked.minecraft_name}` : ''}?`,
    confirmLabel: 'Ban'
  })) return;

  if (includeMinecraft && linked) await minecraftBan(linked.minecraft_name, reason);
  await interaction.guild.members.ban(user.id, { reason });
  if (linked) {
    statements.setLinkedStatus.run({
      discordId: user.id,
      status: 'banned',
      suspicious: linked.suspicious,
      reason: linked.suspicious_reason
    });
  }

  addCase('ban', user.id, linked?.minecraft_uuid ?? null, interaction.user.id, reason);
  audit('moderation.ban', {
    discordId: user.id,
    minecraftUuid: linked?.minecraft_uuid ?? null,
    data: { reason, includeMinecraft, moderatorId: interaction.user.id }
  });
  await modLog(client, 'Member Banned', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Minecraft', value: linked?.minecraft_name ?? 'Not linked', inline: true },
    { name: 'Reason', value: reason }
  ]);
  await interaction.editReply(`Banned ${user.tag}.`);
}

async function handleUnlink(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Unlinked by staff';
  const linked = statements.findLinkedByDiscord.get(user.id);
  if (!linked) return interaction.editReply('That Discord user is not linked.');
  if (!await confirmAction(interaction, {
    title: 'Confirm Unlink',
    body: `Unlink ${user.tag} from ${linked.minecraft_name}?`,
    confirmLabel: 'Unlink'
  })) return;

  statements.setLinkedStatus.run({
    discordId: user.id,
    status: 'unlinked',
    suspicious: linked.suspicious,
    reason: linked.suspicious_reason
  });
  const whitelistResult = await optionalSideEffect(client, {
    type: 'minecraft.whitelist_remove',
    action: 'Remove Minecraft whitelist entry',
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    fields: [
      { name: 'Target', value: `<@${user.id}>`, inline: true },
      { name: 'Minecraft', value: linked.minecraft_name, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
    ],
    run: () => whitelistRemove(linked.minecraft_name)
  });

  addCase('unlink', user.id, linked.minecraft_uuid, interaction.user.id, reason);
  audit('moderation.unlink', {
    discordId: user.id,
    minecraftUuid: linked.minecraft_uuid,
    data: { reason, moderatorId: interaction.user.id, whitelistOk: whitelistResult.ok }
  });
  await modLog(client, 'Member Unlinked', [
    { name: 'Target', value: `<@${user.id}>`, inline: true },
    { name: 'Minecraft', value: linked.minecraft_name, inline: true },
    whitelistResult.ok ? null : { name: 'Whitelist Warning', value: whitelistResult.error },
    { name: 'Reason', value: reason }
  ].filter(Boolean));
  await interaction.editReply(`Unlinked ${user.tag} from ${linked.minecraft_name}.${whitelistResult.ok ? '' : ` Staff warning: whitelist removal failed: ${whitelistResult.error}.`}`);
}

const notificationStyles = {
  info: { color: 0x2f80ed, label: 'Info' },
  success: { color: 0x2f7d67, label: 'Success' },
  warning: { color: 0xffb020, label: 'Warning' },
  danger: { color: 0xd94848, label: 'Danger' },
  event: { color: 0x8b5cf6, label: 'Event' }
};

async function handleNotification(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!config.previewNotifChannelId) {
    return interaction.editReply('PREVIEW_NOTIF_CHANNEL_ID is not configured.');
  }
  const previewChannel = await interaction.client.channels.fetch(config.previewNotifChannelId).catch(() => null);
  if (!previewChannel?.isTextBased()) {
    return interaction.editReply('The configured notification preview channel is missing or not text-based.');
  }

  const title = interaction.options.getString('title', true).trim();
  const message = formatNotificationMessage(interaction.options.getString('message', true));
  const style = interaction.options.getString('style') ?? 'info';
  const footer = interaction.options.getString('footer')?.trim();
  const buttonText = interaction.options.getString('button_text')?.trim();
  const buttonUrl = interaction.options.getString('button_url')?.trim();
  const styleConfig = notificationStyles[style] ?? notificationStyles.info;

  if (!title || !message) {
    return interaction.editReply('Title and message cannot be empty.');
  }
  if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
    return interaction.editReply('Button text and button URL must be provided together.');
  }
  const parsedButtonUrl = buttonUrl ? parseHttpUrl(buttonUrl) : null;
  if (buttonUrl && !parsedButtonUrl) {
    return interaction.editReply('Button URL must start with http:// or https://.');
  }

  const preview = statements.notificationPreviews.create({
    title,
    message,
    style,
    footer,
    buttonText,
    buttonUrl: parsedButtonUrl,
    createdBy: interaction.user.id,
    previewChannelId: previewChannel.id
  });
  const embed = notificationEmbed(preview, styleConfig, interaction.user.tag)
    .addFields({ name: 'Preview ID', value: String(preview.id), inline: true });
  const components = notificationComponents(buttonText, parsedButtonUrl);

  const previewMessage = await previewChannel.send({
    content: `Notification preview ID: \`${preview.id}\``,
    embeds: [embed],
    components,
    allowedMentions: { parse: [] }
  });
  statements.notificationPreviews.setPreviewMessage({ id: preview.id, messageId: previewMessage.id });
  audit('notification.preview_created', {
    discordId: interaction.user.id,
    data: { previewId: preview.id, previewChannelId: previewChannel.id, title, style, hasButton: components.length > 0 }
  });
  await staffAuditLog(client, 'Notification Preview Created', [
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Preview ID', value: String(preview.id), inline: true },
    { name: 'Preview Channel', value: `<#${previewChannel.id}>`, inline: true },
    { name: 'Style', value: styleConfig.label, inline: true },
    components.length > 0 ? { name: 'Button', value: `${buttonText} -> ${buttonUrl}` } : null,
    { name: 'Title', value: title }
  ].filter(Boolean));
  await interaction.editReply(`Notification preview \`${preview.id}\` sent to <#${previewChannel.id}>.`);
}

async function handleNotificationPublish(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const id = interaction.options.getInteger('id', true);
  const preview = statements.notificationPreviews.get(id);
  if (!preview) {
    return interaction.editReply(`Notification preview \`${id}\` was not found.`);
  }
  if (preview.published_at) {
    return interaction.editReply(`Notification preview \`${id}\` was already published.`);
  }

  const channel = interaction.options.getChannel('channel', true);
  if (!channel?.isTextBased()) {
    return interaction.editReply('The selected channel is not text-based.');
  }
  const roleIds = notificationPublishRoleIds(interaction);
  const styleConfig = notificationStyles[preview.style] ?? notificationStyles.info;
  const sent = await channel.send({
    content: roleIds.length ? roleIds.map((roleId) => `<@&${roleId}>`).join(' ') : undefined,
    embeds: [notificationEmbed(preview, styleConfig, interaction.user.tag)],
    components: notificationComponents(preview.button_text, preview.button_url),
    allowedMentions: roleIds.length ? { roles: roleIds } : { parse: [] }
  });

  statements.notificationPreviews.markPublished({
    id,
    publishedBy: interaction.user.id,
    channelId: channel.id,
    messageId: sent.id,
    roleIds
  });
  audit('notification.published', {
    discordId: interaction.user.id,
    data: { previewId: id, channelId: channel.id, roleIds }
  });
  await staffAuditLog(client, 'Notification Published', [
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Preview ID', value: String(id), inline: true },
    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
    roleIds.length ? { name: 'Roles', value: roleIds.map((roleId) => `<@&${roleId}>`).join(', ') } : null
  ].filter(Boolean));
  return interaction.editReply(`Notification preview \`${id}\` published in <#${channel.id}>.`);
}

function notificationComponents(buttonText, buttonUrl) {
  if (!buttonText && !buttonUrl) return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(buttonText)
        .setURL(buttonUrl)
        .setStyle(ButtonStyle.Link)
    )
  ];
}

function parseHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function notificationEmbed(preview, styleConfig, fallbackUserTag) {
  return new EmbedBuilder()
    .setTitle(preview.title)
    .setDescription(preview.message)
    .setColor(styleConfig.color)
    .setTimestamp(new Date())
    .setFooter({ text: preview.footer || `SHD Lifesteal - sent by ${fallbackUserTag}` });
}

function formatNotificationMessage(value) {
  return value
    .replaceAll('\\n', '\n')
    .replaceAll('{br}', '\n')
    .replaceAll('{BR}', '\n')
    .trim();
}

function notificationPublishRoleIds(interaction) {
  return [...new Set([1, 2, 3, 4, 5]
    .map((index) => interaction.options.getRole(`role_${index}`)?.id)
    .filter(Boolean))];
}

async function handleData(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();
  if (!hasSensitiveDataAccess(interaction)) {
    return interaction.editReply(missingPermissionMessage(subcommand === 'export' ? 'export bot data' : 'create data backups'));
  }

  if (subcommand === 'backup') {
    const backupPath = statements.backup.run();
  audit('data.backup_created', {
      discordId: interaction.user.id,
      data: { backupPath }
    });
    await modLog(client, 'Bot Data Backup Created', [
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Path', value: backupPath }
    ]);
    await staffAuditLog(client, 'Bot Data Backup Created', [
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Path', value: backupPath }
    ]);
    return interaction.editReply(`Backup created: ${backupPath}`);
  }

  const collection = interaction.options.getString('collection', true);
  const snapshot = statements.snapshot.get();
  const payload = collection === 'all' ? snapshot : snapshot[collection];
  if (payload == null) {
    return interaction.editReply('Unknown collection.');
  }

  const buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  const attachment = new AttachmentBuilder(buffer, {
    name: `lifesteal-${collection}-${new Date().toISOString().slice(0, 10)}.json`
  });
  audit('data.exported', {
    discordId: interaction.user.id,
    data: { collection }
  });
  await modLog(client, 'Bot Data Exported', [
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Collection', value: collection, inline: true }
  ]);
  await interaction.editReply({
    content: `Exported ${collection}.`,
    files: [attachment]
  });
}

async function linkedFromOptions(interaction) {
  const user = interaction.options.getUser('user');
  const minecraftName = interaction.options.getString('minecraft_name');

  let linked = null;
  if (user) linked = statements.findLinkedByDiscord.get(user.id);
  if (!linked && minecraftName) {
    const profile = await resolveMinecraftProfile(minecraftName);
    recordMinecraftSnapshot(profile);
    linked = statements.findLinkedByMinecraft.get(profile.uuid);
  }
  return linked;
}

function compactSignup(signup) {
  return [
    `Minecraft: ${signup.minecraft_name ?? 'Unknown'}`,
    `Experience: ${signup.lifesteal_experience || 'Not answered'}`,
    `Found server: ${signup.found_server || 'Not answered'}`,
    `Timezone: ${signup.timezone || 'Not answered'}`,
    `Understands PvP: ${signup.understands_pvp ? 'Yes' : 'No'}`,
    `Rules agreement: ${signup.rules_agreement ? 'Yes' : 'No'}`,
    signup.extra ? `Extra: ${signup.extra}` : null
  ].filter(Boolean).join('\n').slice(0, 1024);
}

function profileSummary(linked) {
  return [
    `SHD ID: ${linked.shd_id ?? 'Not assigned'}`,
    `Minecraft: ${linked.minecraft_name ?? 'Unknown'}`,
    `Role: ${linked.role ?? 'player'}`,
    `Region/timezone: ${linked.region ?? 'Not set'}`,
    `Team: ${linked.team_name ?? 'Not set'}`,
    `Event interest: ${linked.event_interest ?? 'Not set'}`,
    `Public stats opt-in: ${linked.public_stats_opt_in ? 'Yes' : 'No'}`,
    `Status: ${linked.status}`,
    `Risk: ${linked.risk_score ?? 0} (${linked.risk_band ?? 'low'})`
  ].join('\n').slice(0, 1024);
}

function normalizeShdId(value) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  return raw.startsWith('SHD') ? raw : `SHD${raw}`;
}

function formatLinkedList(rows) {
  if (!rows.length) return 'None';
  return rows.slice(0, 15)
    .map((row) => `<@${row.discord_id}> / ${row.minecraft_name} / ${row.status} / risk ${row.risk_score ?? 0}`)
    .join('\n');
}

function buildTimeline(linked) {
  const events = [];
  for (const row of statements.findAuditForAccount.all(linked.discord_id, linked.minecraft_uuid)) {
    events.push({ at: row.created_at, type: row.type, text: safeJsonSummary(row.data_json) });
  }
  for (const row of statements.findCasesForAccount.all(linked.discord_id, linked.minecraft_uuid)) {
    events.push({ at: row.created_at, type: `case:${row.action}`, text: row.reason || `Case #${row.id}` });
    if (row.closed_at) {
      events.push({ at: row.closed_at, type: 'case.closed', text: row.close_reason || `Case #${row.id} closed` });
    }
  }
  for (const row of statements.findAppealsForAccount.all(linked.discord_id, linked.minecraft_uuid)) {
    events.push({ at: row.created_at, type: `appeal.${row.status}`, text: `Appeal #${row.id}: ${row.reason}` });
    if (row.closed_at) {
      events.push({ at: row.closed_at, type: `appeal.${row.status}`, text: row.decision_reason || `Appeal #${row.id}` });
    }
  }
  for (const row of statements.findNotesForAccount.all(linked.discord_id, linked.minecraft_uuid)) {
    events.push({ at: row.created_at, type: 'note', text: `#${row.id} by <@${row.author_id}>: ${row.text}` });
  }
  for (const row of statements.findDiscordNameHistory.all(linked.discord_id)) {
    events.push({ at: row.last_seen_at, type: 'discord.name_seen', text: row.username });
  }
  for (const row of statements.findMinecraftNameHistory.all(linked.minecraft_uuid)) {
    events.push({ at: row.last_seen_at, type: 'minecraft.name_seen', text: row.username });
  }
  return events.sort((a, b) => a.at - b.at);
}

function safeJsonSummary(json) {
  try {
    const value = JSON.parse(json || '{}');
    const entries = Object.entries(value).filter(([, item]) => item != null && item !== '');
    if (entries.length === 0) return 'No details';
    return entries.slice(0, 3).map(([key, item]) => `${key}: ${String(item)}`).join(', ');
  } catch (_error) {
    return 'No details';
  }
}

async function syncSuspiciousRole(guild, discordId, risk, clientForLog = null, context = {}) {
  if (!guild || !config.suspiciousRoleId) return { ok: true };
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return { ok: true };

  return optionalSideEffect(clientForLog, {
    type: risk.score >= 50 ? 'discord.role_add.suspicious' : 'discord.role_remove.suspicious',
    action: risk.score >= 50 ? 'Add suspicious Discord role from risk sync' : 'Remove suspicious Discord role from risk sync',
    discordId,
    minecraftUuid: context.minecraftUuid ?? null,
    fields: [
      { name: 'Target', value: `<@${discordId}>`, inline: true },
      { name: 'Role', value: `<@&${config.suspiciousRoleId}>`, inline: true },
      { name: 'Risk', value: `${risk.score} (${risk.band})`, inline: true },
      context.source ? { name: 'Source', value: context.source, inline: true } : null
    ].filter(Boolean),
    run: () => risk.score >= 50
      ? member.roles.add(config.suspiciousRoleId, `Risk ${risk.score}: ${risk.band}`)
      : member.roles.remove(config.suspiciousRoleId, 'Risk below suspicious threshold')
  });
}

async function optionalSideEffect(clientForLog, { type, action, discordId = null, minecraftUuid = null, fields = [], run }) {
  try {
    const value = await run();
    return { ok: true, value, error: null };
  } catch (error) {
    const message = error?.message || String(error);
    audit(`${type}.failed`, {
      discordId,
      minecraftUuid,
      data: {
        action,
        error: message
      }
    });

    if (clientForLog) {
      await staffAuditLog(clientForLog, 'Bot Side Effect Failed', [
        { name: 'Action', value: action, inline: false },
        ...fields,
        { name: 'Error', value: message }
      ]);
    }

    return { ok: false, value: null, error: message };
  }
}

function addCase(action, targetDiscordId, targetMinecraftUuid, moderatorId, reason) {
  statements.addCase.run({
    action,
    targetDiscordId,
    targetMinecraftUuid,
    moderatorId,
    reason,
    createdAt: Date.now()
  });
}

function startSolvedTicketAutoArchive(client) {
  const run = () => archiveDueSolvedTickets(client).catch((error) => console.error('Solved ticket auto-archive failed', error));
  run();
  setInterval(run, 5 * 60 * 1000);
}

async function archiveDueSolvedTickets(client) {
  const now = Date.now();
  const tickets = (statements.snapshot.get().ticket_threads ?? [])
    .filter((ticket) => ticket.status === 'open')
    .filter((ticket) => Number(ticket.answers?.autoCloseAt ?? 0) > 0)
    .filter((ticket) => Number(ticket.answers.autoCloseAt) <= now);

  for (const ticket of tickets) {
    const channel = await client.channels.fetch(ticket.thread_id).catch(() => null);
    statements.closeTicketThread.run(ticket.thread_id);
    audit('ticket.auto_closed', {
      discordId: ticket.discord_id,
      minecraftUuid: ticket.minecraft_uuid,
      data: {
        type: ticket.type,
        threadId: ticket.thread_id,
        reason: 'Solved ticket auto-closed after 12 hours.'
      }
    });

    if (channel?.isThread?.()) {
      await channel.send('Ticket auto-closed 12 hours after confirmation.').catch(() => null);
      await channel.setArchived(true, 'Solved ticket auto-closed after 12 hours.').catch(() => null);
    }
    await modLog(client, 'Ticket Auto Closed', [
      { name: 'Type', value: ticket.type, inline: true },
      { name: 'User', value: ticket.discord_id ? `<@${ticket.discord_id}>` : 'Unknown', inline: true },
      { name: 'Thread', value: `<#${ticket.thread_id}>`, inline: true }
    ]).catch(() => null);
  }
}

async function confirmAction(interaction, { title, body, confirmLabel }) {
  const confirmId = `confirm:${interaction.id}`;
  const cancelId = `cancel:${interaction.id}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel(confirmLabel)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  const message = await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setTitle(title)
      .setColor(0xff5f56)
      .setDescription(body)],
    components: [row]
  });

  try {
    const confirmation = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (componentInteraction) =>
        componentInteraction.user.id === interaction.user.id &&
        [confirmId, cancelId].includes(componentInteraction.customId)
    });

    await confirmation.deferUpdate();
    if (confirmation.customId === cancelId) {
      await interaction.editReply({ content: 'Cancelled.', embeds: [], components: [] });
      return false;
    }

    await interaction.editReply({ content: 'Confirmed. Applying action...', embeds: [], components: [] });
    return true;
  } catch (_error) {
    await interaction.editReply({ content: 'Confirmation expired. No action was taken.', embeds: [], components: [] });
    return false;
  }
}

function recordDiscordSnapshot(user) {
  statements.recordDiscordName.run({
    discordId: user.id,
    username: user.tag ?? user.username,
    seenAt: Date.now()
  });
}

function recordMinecraftSnapshot(profile) {
  statements.recordMinecraftName.run({
    minecraftUuid: profile.uuid,
    username: profile.name,
    seenAt: Date.now()
  });
}

function hasCommandAccess(interaction) {
  switch (interaction.commandName) {
    case 'kick':
      return hasStaffOrPermission(interaction, PermissionFlagsBits.KickMembers);
    case 'ban':
      return hasStaffOrPermission(interaction, PermissionFlagsBits.BanMembers);
    case 'purge':
      return hasStaffOrPermission(interaction, PermissionFlagsBits.ManageMessages);
    case 'data':
      return hasSensitiveDataAccess(interaction);
    default:
      return hasStaffAccess(interaction);
  }
}

client.login(config.discordToken);
