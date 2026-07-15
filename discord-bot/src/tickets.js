import {
  existsSync,
  readFileSync
} from 'node:fs';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, appealLog, logToChannel, modLog, staffAuditLog } from './logger.js';
import { resolveMinecraftProfile } from './minecraft.js';
import { hasStaffAccess } from './permissions.js';

const APPEAL_BUTTON_ID = 'ticket:appeal:open';
const JOIN_BUTTON_ID = 'ticket:join:open';
const SUPPORT_JOIN_BUTTON_ID = 'ticket:new:join';
const SUPPORT_APPEAL_BUTTON_ID = 'ticket:new:appeal';
const SUPPORT_REPORT_BUTTON_ID = 'ticket:new:report';
const CLOSE_BUTTON_ID = 'ticket:close';
const CLAIM_BUTTON_ID = 'ticket:claim';
const APPEAL_MODAL_ID = 'ticket:appeal:modal';
const SUPPORT_JOIN_MODAL_ID = 'ticket:new:join:modal';
const SUPPORT_APPEAL_MODAL_ID = 'ticket:new:appeal:modal';
const SUPPORT_REPORT_MODAL_ID = 'ticket:new:report:modal';
const CLOSE_MODAL_ID = 'ticket:close:modal';
const APPLICATION_CODE_PATTERN = /\bSHD-APP-[A-Z0-9]{4,12}\b/i;
const APPEAL_TICKETS_PAUSED = true;
const APPEAL_TICKETS_PAUSED_MESSAGE = 'Appeal tickets are temporarily closed. Please check back later.';

export async function handlePanelCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const type = interaction.options.getString('type', true);
  if (!interaction.channel?.threads) {
    return interaction.editReply('This channel cannot create threads.');
  }

  if (type === 'support') {
    const embed = new EmbedBuilder()
      .setTitle('SHD Lifesteal Support')
      .setColor(0x35b87f)
      .setDescription([
        'Choose the ticket type you need. The bot will collect the required information before opening the thread so staff can start with the right context.',
        '',
        '**Apply / Join Lifesteal**',
        'Enter your Minecraft username. Staff will review the ticket and can confirm your access from there.',
        '',
        '**Ban Appeal**',
        'Enter your ban ID and Minecraft username. Use the ticket to explain what happened and share evidence if available.',
        '',
        '**Report Player**',
        'Enter the Minecraft username of the player you want to report. Staff will ask for details, evidence, and timing in the ticket.',
        '',
        'You will receive an SHD ID, which is your Lifesteal support identity for future appeals, reports, events, and staff lookups.'
      ].join('\n'));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(SUPPORT_JOIN_BUTTON_ID)
        .setLabel('Apply / Join Lifesteal')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(SUPPORT_APPEAL_BUTTON_ID)
        .setLabel('Ban Appeal')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(SUPPORT_REPORT_BUTTON_ID)
        .setLabel('Report Player')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    audit('ticket.panel_created', {
      discordId: interaction.user.id,
      data: { type, channelId: interaction.channel.id }
    });
    await modLog(interaction.client, 'Ticket Panel Created', [
      { name: 'Type', value: type, inline: true },
      { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
      { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
    ]);
    return interaction.editReply('Support panel posted.');
  }

  const isAppeal = type === 'appeal';
  const portalUrl = config.supportPortalUrl.replace(/\/$/, '');
  const embed = new EmbedBuilder()
    .setTitle(isAppeal ? 'Minecraft Appeals' : 'Minecraft Applications')
    .setColor(isAppeal ? 0xff5f56 : 0x35b87f)
    .setDescription(isAppeal
      ? [
          'Use the SHD Support Portal for appeal information and then open a staff ticket here when you are ready.',
          `${portalUrl}/ban-appeal`,
          '',
          'The ticket will ask for your ban ID, Minecraft username, and appeal reason.'
        ].join('\n')
      : [
          'Read the Lifesteal rules first and generate your rules key:',
          'https://lifesteal.shd-esports.com/rules',
          '',
          'Then apply through the SHD Support Portal and open a ticket here with your application key.',
          `${portalUrl}/signup`,
          '',
          'Application keys look like SHD-APP-ABC123. The bot will verify the key in your ticket and notify staff.'
        ].join('\n'));

  const button = new ButtonBuilder()
    .setCustomId(isAppeal ? APPEAL_BUTTON_ID : JOIN_BUTTON_ID)
    .setLabel(isAppeal && APPEAL_TICKETS_PAUSED ? 'Appeal Tickets Closed' : isAppeal ? 'Open Appeal Ticket' : 'Open Application Ticket')
    .setStyle(isAppeal ? ButtonStyle.Danger : ButtonStyle.Primary)
    .setDisabled(isAppeal && APPEAL_TICKETS_PAUSED);

  await interaction.channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  });
  audit('ticket.panel_created', {
    discordId: interaction.user.id,
    data: { type, channelId: interaction.channel.id }
  });
  await modLog(interaction.client, 'Ticket Panel Created', [
    { name: 'Type', value: type, inline: true },
    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
  ]);
  await interaction.editReply(`${isAppeal ? 'Appeal' : 'Join'} panel posted.`);
}

export async function handleTicketInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId === APPEAL_BUTTON_ID) {
      if (APPEAL_TICKETS_PAUSED) {
        return interaction.reply({ content: APPEAL_TICKETS_PAUSED_MESSAGE, ephemeral: true });
      }
      return showAppealModal(interaction);
    }
    if (interaction.customId === JOIN_BUTTON_ID) {
      return openJoinTicket(interaction);
    }
    if (interaction.customId === SUPPORT_JOIN_BUTTON_ID) {
      return showSupportJoinModal(interaction);
    }
    if (interaction.customId === SUPPORT_APPEAL_BUTTON_ID) {
      return openSupportAppealTicket(interaction);
    }
    if (interaction.customId === SUPPORT_REPORT_BUTTON_ID) {
      return showSupportReportModal(interaction);
    }
    if (interaction.customId === CLOSE_BUTTON_ID) {
      return handleCloseTicketButton(interaction);
    }
    if (interaction.customId === CLAIM_BUTTON_ID) {
      return claimTicket(interaction);
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === APPEAL_MODAL_ID) {
    if (APPEAL_TICKETS_PAUSED) {
      return interaction.reply({ content: APPEAL_TICKETS_PAUSED_MESSAGE, ephemeral: true });
    }
    return openAppealTicket(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === CLOSE_MODAL_ID) {
    return closeTicket(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === SUPPORT_JOIN_MODAL_ID) {
    return openSupportJoinTicket(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === SUPPORT_APPEAL_MODAL_ID) {
    return openSupportAppealTicket(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === SUPPORT_REPORT_MODAL_ID) {
    return openSupportReportTicket(interaction);
  }

  return false;
}

export async function handleTicketMessage(message) {
  if (message.author.bot || !message.channel?.isThread?.()) {
    return false;
  }

  const verifiedApplication = await handleApplicationCodeMessage(message);
  if (verifiedApplication) {
    return true;
  }

  const ticket = statements.findTicketByThread.get(message.channel.id);
  if (!ticket || ticket.type !== 'join' || ticket.discord_id !== message.author.id) {
    return false;
  }
  if (statements.findSupportApplicationByThread.get(message.channel.id)) {
    return false;
  }

  await message.reply([
    'This ticket needs an application key from the SHD Support Portal.',
    `Apply here: ${config.supportPortalUrl.replace(/\/$/, '')}/signup`,
    'Read the rules and generate your rules key first: https://lifesteal.shd-esports.com/rules',
    '',
    'Then send the `SHD-APP-...` key in this ticket.'
  ].join('\n'));
  return true;
}

async function handleApplicationCodeMessage(message) {
  const match = message.content.match(APPLICATION_CODE_PATTERN);
  if (!match) {
    return false;
  }

  const ticket = statements.findTicketByThread.get(message.channel.id);
  if (!ticket || ticket.type !== 'join') {
    return false;
  }
  if (ticket.discord_id !== message.author.id) {
    await message.reply('Only the applicant who opened this join ticket can attach an application key.');
    return true;
  }

  const code = match[0].toUpperCase();
  const application = statements.findSupportApplicationByCode.get(code);
  if (!application) {
    await message.reply('I could not find an application with that code. Check the code and send it again.');
    return true;
  }

  if (application.status !== 'submitted') {
    if (application.discord_id_verified === message.author.id) {
      const statusMessages = {
        ticket_verified: 'This application is already verified and waiting for staff review.',
        approved_whitelist_pending: 'This application is approved, but staff still needs to finish Minecraft access.',
        approved: 'This application has already been approved.',
        denied: 'This application has already been denied.'
      };
      await message.reply(statusMessages[application.status] ?? `This application is already ${application.status}.`);
    } else {
      await message.reply('This application code has already been claimed by another Discord account or is no longer open.');
    }
    return true;
  }

  if (application.discord_id_claimed && application.discord_id_claimed !== message.author.id) {
    audit('support.application_discord_id_mismatch', {
      discordId: message.author.id,
      data: {
        applicationId: application.id,
        claimedDiscordId: application.discord_id_claimed,
        threadId: message.channel.id
      }
    });
    await message.reply('The Discord ID on this application does not match your account. Staff can help if you entered the wrong ID.');
    return true;
  }

  if (!discordNameMatches(application.discord_username, message)) {
    audit('support.application_discord_name_mismatch', {
      discordId: message.author.id,
      data: {
        applicationId: application.id,
        claimedDiscordUsername: application.discord_username,
        actualUsername: message.author.username,
        actualTag: message.author.tag,
        threadId: message.channel.id
      }
    });
    await message.reply('The Discord username on this application does not match your current Discord account. Staff can help if you changed names or entered it differently.');
    return true;
  }

  const verifiedAt = Date.now();
  const updated = statements.claimSupportApplicationTicket.run({
    code,
    discordId: message.author.id,
    threadId: message.channel.id,
    status: 'ticket_verified',
    verifiedAt
  });

  audit('support.application_ticket_verified', {
    discordId: message.author.id,
    data: {
      applicationId: updated.id,
      applicationCode: updated.code,
      threadId: message.channel.id
    }
  });

  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('Application Verified')
      .setColor(0x35b87f)
      .setDescription([
        `<@${message.author.id}> your application key is verified and attached to this ticket.`,
        'Staff will review your answers here. If something is missing or looks wrong, they will ask you in this thread.',
        'If you are approved, the bot will be the first to tell you and will prepare your Minecraft account for Lifesteal.'
      ].join('\n'))]
  });

  await message.channel.send({
    content: 'Staff review controls:',
    components: [ticketStaffActionRow()]
  });

  await logToChannel(message.client, config.supportApplicationLogChannelId || config.ticketNotifyChannelId || config.modLogChannelId, 'Support Application Ready For Review', supportApplicationFields(updated, [
    { name: 'Ticket', value: `<#${message.channel.id}>`, inline: true },
    { name: 'Applicant', value: `<@${message.author.id}>`, inline: true },
    { name: 'Approve', value: `/approve application_code:${updated.code}` }
  ]));
  await staffAuditLog(message.client, 'Support Application Verified In Ticket', [
    { name: 'Application', value: `#${updated.id} / ${updated.code}`, inline: true },
    { name: 'Applicant', value: `<@${message.author.id}>`, inline: true },
    { name: 'Thread', value: `<#${message.channel.id}>`, inline: true }
  ]);

  return true;
}

function discordNameMatches(claimedUsername, message) {
  const claimed = normalizeDiscordName(claimedUsername);
  const candidates = [
    message.author.username,
    message.author.tag,
    message.author.globalName,
    message.member?.displayName
  ].map(normalizeDiscordName).filter(Boolean);
  return candidates.includes(claimed);
}

function normalizeDiscordName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\s+/g, '');
}

function supportApplicationFields(application, extra = []) {
  return [
    { name: 'Application', value: `#${application.id} / ${application.code}`, inline: true },
    { name: 'Status', value: application.status, inline: true },
    { name: 'Minecraft', value: application.minecraft_name, inline: true },
    { name: 'Rules', value: `${application.rules_version} / ${application.rules_code}`, inline: true },
    ...extra,
    { name: 'Found Lifesteal', value: application.answers.foundLifesteal },
    { name: 'Experience', value: application.answers.experience },
    { name: 'Motivation', value: application.answers.motivation },
    application.answers.team ? { name: 'Team', value: application.answers.team } : null,
    application.answers.content ? { name: 'Extra', value: application.answers.content } : null
  ].filter(Boolean);
}

async function handleCloseTicketButton(interaction) {
  if (!hasTicketStaffAccess(interaction)) {
    return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
  }
  if (!interaction.channel?.isThread?.()) {
    return interaction.reply({ content: 'This can only be used inside a ticket thread.', ephemeral: true });
  }

  const ticket = statements.findTicketByThread.get(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: 'No open ticket record found for this thread.', ephemeral: true });
  }
  if (ticketSolved(ticket)) {
    await interaction.deferReply({ ephemeral: true });
    return closeTicketRecord(interaction, ticket, 'Solved ticket closed by staff.', 'Ticket closed.');
  }

  const modal = new ModalBuilder()
    .setCustomId(CLOSE_MODAL_ID)
    .setTitle('Close Ticket');

  const reason = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Close reason')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  return interaction.showModal(modal);
}

async function closeTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasTicketStaffAccess(interaction)) {
    return interaction.editReply('Only staff can close tickets.');
  }
  if (!interaction.channel?.isThread?.()) {
    return interaction.editReply('This can only be used inside a ticket thread.');
  }

  const ticket = statements.findTicketByThread.get(interaction.channel.id);
  if (!ticket) {
    return interaction.editReply('No open ticket record found for this thread.');
  }

  return closeTicketRecord(interaction, ticket, interaction.fields.getTextInputValue('reason').trim(), 'Ticket closed.');
}

async function closeTicketRecord(interaction, ticket, reason, replyText) {
  statements.closeTicketThread.run(interaction.channel.id);
  audit('ticket.closed', {
    discordId: ticket.discord_id,
    minecraftUuid: ticket.minecraft_uuid,
    data: {
      type: ticket.type,
      threadId: interaction.channel.id,
      reason,
      closedBy: interaction.user.id
    }
  });
  await modLog(interaction.client, 'Ticket Closed', [
    { name: 'Type', value: ticket.type, inline: true },
    { name: 'User', value: `<@${ticket.discord_id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Reason', value: reason }
  ]);
  await staffAuditLog(interaction.client, 'Ticket Closed With Reason', [
    { name: 'Thread', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Reason', value: reason }
  ]);

  await interaction.channel.send(`Ticket closed by <@${interaction.user.id}>: ${reason}`);
  await interaction.channel.setArchived(true, reason).catch(() => null);
  await interaction.editReply(replyText);
}

function ticketSolved(ticket) {
  return Boolean(ticket?.answers?.solvedAt || ticket?.answers?.confirmedAt);
}

async function claimTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasTicketStaffAccess(interaction)) {
    return interaction.editReply('Only staff can claim tickets.');
  }
  if (!interaction.channel?.isThread?.()) {
    return interaction.editReply('This can only be used inside a ticket thread.');
  }

  const ticket = statements.findTicketByThread.get(interaction.channel.id);
  if (!ticket) {
    return interaction.editReply('No open ticket record found for this thread.');
  }

  const claim = statements.claimTicketReview.run({
    threadId: interaction.channel.id,
    staffId: interaction.user.id,
    claimedAt: Date.now()
  });
  if (!claim.ok && claim.reason === 'claimed') {
    return interaction.editReply(`This review is already claimed by <@${claim.ticket.claimed_by}>.`);
  }
  if (!claim.ok) {
    return interaction.editReply('This ticket could not be claimed because it is no longer open.');
  }
  if (!claim.changed) {
    return interaction.editReply('You already own this review.');
  }

  audit('ticket.claimed', {
    discordId: ticket.discord_id,
    minecraftUuid: ticket.minecraft_uuid,
    data: {
      type: ticket.type,
      threadId: interaction.channel.id,
      claimedBy: interaction.user.id
    }
  });
  await staffAuditLog(interaction.client, 'Ticket Claimed', [
    { name: 'Thread', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Type', value: ticket.type, inline: true }
  ]);
  await interaction.channel.send(`Review claimed by <@${interaction.user.id}>.`);
  return interaction.editReply('Ticket claimed.');
}

function showSupportJoinModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(SUPPORT_JOIN_MODAL_ID)
    .setTitle('Apply / Join Lifesteal');

  const minecraftName = new TextInputBuilder()
    .setCustomId('minecraft_name')
    .setLabel('Your Minecraft username')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(16);

  modal.addComponents(new ActionRowBuilder().addComponents(minecraftName));
  return interaction.showModal(modal);
}

function showSupportReportModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(SUPPORT_REPORT_MODAL_ID)
    .setTitle('Report Player');

  const reportedMinecraftName = new TextInputBuilder()
    .setCustomId('reported_minecraft_name')
    .setLabel('Minecraft username you want to report')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(16);

  modal.addComponents(new ActionRowBuilder().addComponents(reportedMinecraftName));
  return interaction.showModal(modal);
}

async function openSupportJoinTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const existing = await findUsableOpenTicket(interaction, 'lifesteal_join');
  if (existing) {
    return interaction.editReply(`You already have an open Lifesteal join thread: <#${existing.thread_id}>`);
  }

  const minecraftNameInput = interaction.fields.getTextInputValue('minecraft_name').trim();
  const profile = await resolveMinecraftProfile(minecraftNameInput);
  const identity = statements.ensureLifestealIdentity.run({
    discordId: interaction.user.id,
    minecraftUuid: profile.uuid,
    minecraftName: profile.name,
    createdAt: Date.now()
  });
  const thread = await createTicketThread(interaction, `join-${safeThreadPart(identity.id)}-${safeThreadPart(profile.name)}`);
  statements.createTicketThread.run({
    type: 'lifesteal_join',
    threadId: thread.id,
    channelId: interaction.channel.id,
    discordId: interaction.user.id,
    shdId: identity.id,
    minecraftUuid: profile.uuid,
    minecraftName: profile.name,
    answers: { source: 'new_support_panel' },
    createdAt: Date.now()
  });

  audit('ticket.lifesteal_join_created', {
    discordId: interaction.user.id,
    minecraftUuid: profile.uuid,
    data: { shdId: identity.id, threadId: thread.id, minecraftName: profile.name }
  });

  await thread.send({
    content: `<@${interaction.user.id}>`,
    embeds: [new EmbedBuilder()
      .setTitle('Lifesteal Application')
      .setColor(0x35b87f)
      .setDescription([
        `Hello <@${interaction.user.id}>, thanks for signing up to Lifesteal.`,
        'Staff will be here if they have any questions. Keep your SHD ID because you will need it for future appeals or events.',
        'You can always use `/whatsmyid` to see it again.',
        '',
        identityBlock({
          discordUser: interaction.user,
          shdId: identity.id,
          minecraftName: profile.name,
          minecraftUuid: profile.uuid
        })
      ].join('\n'))],
    components: [ticketStaffActionRow()]
  });

  await sendTicketCreatedNotices(interaction, {
    type: 'lifesteal_join',
    thread,
    minecraftName: profile.name,
    details: [
      { name: 'SHD ID', value: identity.id, inline: true },
      { name: 'Minecraft UUID', value: profile.uuid, inline: false }
    ]
  });
  return interaction.editReply(`Lifesteal application thread created: <#${thread.id}>`);
}

async function openSupportAppealTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const existing = await findUsableOpenTicket(interaction, 'lifesteal_appeal');
  if (existing) {
    return interaction.editReply(`You already have an open appeal thread: <#${existing.thread_id}>`);
  }

  const linked = statements.findLinkedByDiscord.get(interaction.user.id);
  const existingIdentity = statements.findLifestealIdentityByDiscord.get(interaction.user.id);
  const identity = statements.ensureLifestealIdentity.run({
    discordId: interaction.user.id,
    minecraftUuid: linked?.minecraft_uuid ?? existingIdentity?.minecraft_uuid ?? null,
    minecraftName: linked?.minecraft_name ?? existingIdentity?.minecraft_name ?? null,
    createdAt: Date.now()
  });
  const minecraftUuid = linked?.minecraft_uuid ?? identity.minecraft_uuid ?? null;
  const minecraftName = linked?.minecraft_name ?? identity.minecraft_name ?? null;
  const antiCheatAppeals = findAntiCheatAppeals({ discordId: interaction.user.id, minecraftUuid, shdId: identity.id });
  const latestAntiCheatAppeal = antiCheatAppeals[0] ?? null;
  const appealReference = latestAntiCheatAppeal?.appealId ?? identity.id;
  const thread = await createTicketThread(interaction, `appeal-${safeThreadPart(appealReference)}-${safeThreadPart(identity.id)}`);
  statements.createTicketThread.run({
    type: 'lifesteal_appeal',
    threadId: thread.id,
    channelId: interaction.channel.id,
    discordId: interaction.user.id,
    shdId: identity.id,
    minecraftUuid,
    minecraftName,
    answers: {
      source: 'new_support_panel',
      antiCheatAppeals: antiCheatAppeals.map(antiCheatAppealSummary)
    },
    createdAt: Date.now()
  });
  const appeal = statements.createAppeal.run({
    discordId: interaction.user.id,
    minecraftUuid,
    banId: latestAntiCheatAppeal?.appealId ?? null,
    reason: latestAntiCheatAppeal
      ? `Appeal ticket opened for SHD anti-cheat appeal ${latestAntiCheatAppeal.appealId}`
      : 'Appeal ticket opened from Discord support panel',
    createdAt: Date.now()
  });

  audit('ticket.lifesteal_appeal_created', {
    discordId: interaction.user.id,
    minecraftUuid,
    data: {
      shdId: identity.id,
      appealId: appeal.id,
      antiCheatAppealId: latestAntiCheatAppeal?.appealId ?? null,
      evidenceId: latestAntiCheatAppeal?.evidenceId ?? null,
      threadId: thread.id
    }
  });

  await thread.send({
    content: `<@${interaction.user.id}>`,
    embeds: [new EmbedBuilder()
      .setTitle(`Ban Appeal #${appeal.id}`)
      .setColor(0xff5f56)
      .setDescription([
        `Hello <@${interaction.user.id}>, please tell us how we can help with your appeal.`,
        'Describe in detail what happened and add evidence if you have any. Staff will review it and determine the next step.',
        '',
        identityBlock({
          discordUser: interaction.user,
          shdId: identity.id,
          minecraftName: minecraftName ?? 'Not linked',
          minecraftUuid: minecraftUuid ?? 'Not linked',
          extra: antiCheatAppealLines(antiCheatAppeals)
        })
      ].join('\n'))],
    components: [ticketStaffActionRow()]
  });

  await sendTicketCreatedNotices(interaction, {
    type: 'lifesteal_appeal',
    thread,
    minecraftName,
    details: [
      { name: 'SHD ID', value: identity.id, inline: true },
      { name: 'Appeal', value: `#${appeal.id}`, inline: true },
      latestAntiCheatAppeal ? { name: 'SHD AC Appeal ID', value: latestAntiCheatAppeal.appealId, inline: true } : null,
      latestAntiCheatAppeal ? { name: 'Evidence ID', value: latestAntiCheatAppeal.evidenceId, inline: true } : null
    ].filter(Boolean)
  });
  await appealLog(interaction.client, 'Appeal Ticket Created', [
    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'SHD ID', value: identity.id, inline: true },
    { name: 'Minecraft', value: minecraftName ?? 'Not linked', inline: true },
    latestAntiCheatAppeal ? { name: 'SHD AC Appeal ID', value: latestAntiCheatAppeal.appealId, inline: true } : null,
    latestAntiCheatAppeal ? { name: 'Evidence ID', value: latestAntiCheatAppeal.evidenceId, inline: true } : null,
    { name: 'Thread', value: `<#${thread.id}>`, inline: true }
  ].filter(Boolean));
  return interaction.editReply(`Appeal thread created: <#${thread.id}>`);
}

function findAntiCheatAppeals({ minecraftUuid, shdId }) {
  const stored = statements.findAntiCheatRecordsForAccount.all({ minecraftUuid, shdId, limit: 10 })
    .map((record) => ({
      appealId: record.appeal_id,
      evidenceId: record.evidence_id,
      timestamp: record.occurred_at,
      playerName: record.minecraft_name,
      playerId: record.minecraft_uuid,
      action: record.action,
      reasonCode: record.reason_code,
      publicReason: record.public_reason,
      context: record.context ?? ''
    }));
  if (stored.length > 0) {
    return stored;
  }

  if (!existsSync(config.antiCheat.historyPath)) {
    return [];
  }
  const normalizedUuid = normalizeMinecraftUuid(minecraftUuid);
  const normalizedShdId = normalizeShdId(shdId);
  return readFileSync(config.antiCheat.historyPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => parseAntiCheatRecord(line))
    .filter(Boolean)
    .filter((record) => record.appealId)
    .filter((record) =>
      (normalizedUuid && normalizeMinecraftUuid(record.playerId) === normalizedUuid) ||
      (normalizedShdId && record.context.toUpperCase().includes(normalizedShdId))
    )
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 10);
}

function parseAntiCheatRecord(line) {
  try {
    const record = JSON.parse(line);
    return {
      appealId: String(record.appealId ?? '').trim(),
      evidenceId: String(record.evidenceId ?? '').trim(),
      timestamp: String(record.timestamp ?? '').trim(),
      playerName: String(record.playerName ?? '').trim(),
      playerId: String(record.playerId ?? '').trim(),
      action: String(record.action ?? '').trim(),
      reasonCode: String(record.reasonCode ?? '').trim(),
      publicReason: String(record.publicReason ?? '').trim(),
      context: String(record.context ?? '').trim()
    };
  } catch (_error) {
    return null;
  }
}

function antiCheatAppealLines(records) {
  if (records.length === 0) {
    return ['Anti-Cheat Appeal IDs: none found for this linked Minecraft account'];
  }
  const latest = records[0];
  const lines = [
    `Latest Appeal ID: ${latest.appealId}`,
    `Latest Evidence ID: ${latest.evidenceId}`,
    `Latest Detection: ${formatAntiCheatTimestamp(latest.timestamp)} / ${latest.reasonCode || latest.publicReason || 'unknown'}`
  ];
  if (records.length > 1) {
    lines.push('Previous Appeals:');
    for (const record of records.slice(1)) {
      lines.push(`- ${record.appealId} / ${record.evidenceId} / ${formatAntiCheatTimestamp(record.timestamp)} / ${record.reasonCode || 'unknown'}`);
    }
  }
  return lines;
}

function antiCheatAppealSummary(record) {
  return {
    appealId: record.appealId,
    evidenceId: record.evidenceId,
    timestamp: record.timestamp,
    playerName: record.playerName,
    playerId: record.playerId,
    action: record.action,
    reasonCode: record.reasonCode,
    publicReason: record.publicReason
  };
}

function formatAntiCheatTimestamp(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value || 'unknown time';
  }
  return new Date(timestamp).toISOString();
}

function normalizeMinecraftUuid(value) {
  return String(value ?? '').trim().toLowerCase().replaceAll('-', '');
}

function normalizeShdId(value) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  return raw.startsWith('SHD') ? raw : `SHD${raw}`;
}

async function openSupportReportTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const reportedNameInput = interaction.fields.getTextInputValue('reported_minecraft_name').trim();
  const reportedProfile = await resolveMinecraftProfile(reportedNameInput);
  const linkedReporter = statements.findLinkedByDiscord.get(interaction.user.id);
  const reporterIdentity = statements.ensureLifestealIdentity.run({
    discordId: interaction.user.id,
    minecraftUuid: linkedReporter?.minecraft_uuid ?? null,
    minecraftName: linkedReporter?.minecraft_name ?? null,
    createdAt: Date.now()
  });
  const reportedIdentity = statements.ensureLifestealIdentity.run({
    minecraftUuid: reportedProfile.uuid,
    minecraftName: reportedProfile.name,
    createdAt: Date.now()
  });
  const thread = await createTicketThread(interaction, `report-${safeThreadPart(reportedProfile.name)}-${safeThreadPart(reporterIdentity.id)}`);
  statements.createTicketThread.run({
    type: 'lifesteal_report',
    threadId: thread.id,
    channelId: interaction.channel.id,
    discordId: interaction.user.id,
    shdId: reporterIdentity.id,
    minecraftUuid: linkedReporter?.minecraft_uuid ?? null,
    minecraftName: linkedReporter?.minecraft_name ?? null,
    answers: {
      reportedShdId: reportedIdentity.id,
      reportedMinecraftUuid: reportedProfile.uuid,
      reportedMinecraftName: reportedProfile.name,
      source: 'new_support_panel'
    },
    createdAt: Date.now()
  });

  audit('ticket.lifesteal_report_created', {
    discordId: interaction.user.id,
    minecraftUuid: linkedReporter?.minecraft_uuid ?? null,
    data: {
      shdId: reporterIdentity.id,
      reportedShdId: reportedIdentity.id,
      reportedMinecraftUuid: reportedProfile.uuid,
      threadId: thread.id
    }
  });

  await thread.send({
    content: `<@${interaction.user.id}>`,
    embeds: [new EmbedBuilder()
      .setTitle(`Player Report: ${reportedProfile.name}`)
      .setColor(0xffb020)
      .setDescription([
        `Hello <@${interaction.user.id}>, tell us why you want to report **${reportedProfile.name}**.`,
        'Describe what happened, when it happened, and include screenshots, clips, logs, or witnesses if available.',
        '',
        '**Reporter**',
        identityBlock({
          discordUser: interaction.user,
          shdId: reporterIdentity.id,
          minecraftName: linkedReporter?.minecraft_name ?? 'Not linked',
          minecraftUuid: linkedReporter?.minecraft_uuid ?? 'Not linked'
        }),
        '',
        '**Reported Player**',
        identityBlock({
          shdId: reportedIdentity.id,
          minecraftName: reportedProfile.name,
          minecraftUuid: reportedProfile.uuid
        })
      ].join('\n'))],
    components: [ticketStaffActionRow()]
  });

  await sendTicketCreatedNotices(interaction, {
    type: 'lifesteal_report',
    thread,
    minecraftName: linkedReporter?.minecraft_name ?? 'Not linked',
    details: [
      { name: 'Reporter SHD ID', value: reporterIdentity.id, inline: true },
      { name: 'Reported', value: `${reportedProfile.name} / ${reportedIdentity.id}`, inline: true }
    ]
  });
  return interaction.editReply(`Player report thread created: <#${thread.id}>`);
}

function showAppealModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(APPEAL_MODAL_ID)
    .setTitle('Open Appeal Ticket');

  const banId = new TextInputBuilder()
    .setCustomId('ban_id')
    .setLabel('Ban ID')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80);

  const minecraftName = new TextInputBuilder()
    .setCustomId('minecraft_name')
    .setLabel('Minecraft username')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(16);

  const reason = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Why should staff review this?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(banId),
    new ActionRowBuilder().addComponents(minecraftName),
    new ActionRowBuilder().addComponents(reason)
  );

  return interaction.showModal(modal);
}

async function openAppealTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const existing = await findUsableOpenTicket(interaction, 'appeal');
  if (existing) {
    return interaction.editReply(`You already have an open appeal thread: <#${existing.thread_id}>`);
  }

  const banId = interaction.fields.getTextInputValue('ban_id').trim();
  const reason = interaction.fields.getTextInputValue('reason').trim();
  const minecraftNameInput = interaction.fields.getTextInputValue('minecraft_name')?.trim();
  const linked = statements.findLinkedByDiscord.get(interaction.user.id);

  let minecraftUuid = linked?.minecraft_uuid ?? null;
  let minecraftName = linked?.minecraft_name ?? minecraftNameInput;
  if (minecraftNameInput) {
    const profile = await resolveMinecraftProfile(minecraftNameInput).catch(() => null);
    if (profile) {
      minecraftUuid = profile.uuid;
      minecraftName = profile.name;
    }
  }

  const thread = await createTicketThread(interaction, `appeal-${safeThreadPart(banId)}-${safeThreadPart(interaction.user.username)}`);
  statements.createTicketThread.run({
    type: 'appeal',
    threadId: thread.id,
    channelId: interaction.channel.id,
    discordId: interaction.user.id,
    minecraftUuid,
    minecraftName,
    createdAt: Date.now()
  });
  const appeal = statements.createAppeal.run({
    discordId: interaction.user.id,
    minecraftUuid,
    banId,
    reason,
    createdAt: Date.now()
  });
  audit('appeal.ticket_created', {
    discordId: interaction.user.id,
    minecraftUuid,
    data: { appealId: appeal.id, banId, threadId: thread.id }
  });
  await appealLog(interaction.client, 'Appeal Ticket Created', [
    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Minecraft', value: minecraftName ?? 'Not provided', inline: true },
    { name: 'Appeal', value: `#${appeal.id}`, inline: true },
    { name: 'Thread', value: `<#${thread.id}>`, inline: true }
  ]);
  await modLog(interaction.client, 'Appeal Ticket Created', [
    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Minecraft', value: minecraftName ?? 'Not provided', inline: true },
    { name: 'Thread', value: `<#${thread.id}>`, inline: true }
  ]);

  await thread.send({
    content: `<@${interaction.user.id}>`,
    embeds: [new EmbedBuilder()
      .setTitle(`Appeal #${appeal.id}`)
      .setColor(0xff5f56)
      .setDescription([
        `Discord: <@${interaction.user.id}>`,
        `Minecraft: ${minecraftName ?? 'Not provided'}`,
        `Ban ID: ${banId}`,
        '',
        reason
      ].join('\n'))],
    components: [ticketStaffActionRow()]
  });
  await sendTicketCreatedNotices(interaction, {
    type: 'appeal',
    thread,
    minecraftName,
    details: [
      { name: 'Appeal', value: `#${appeal.id}`, inline: true },
      { name: 'Ban ID', value: banId, inline: true }
    ]
  });
  await interaction.editReply(`Appeal thread created: <#${thread.id}>`);
}

async function openJoinTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const existing = await findUsableOpenTicket(interaction, 'join');
  if (existing) {
    return interaction.editReply(`You already have an open join thread: <#${existing.thread_id}>`);
  }

  const thread = await createTicketThread(interaction, `join-${safeThreadPart(interaction.user.username)}`);
  statements.createTicketThread.run({
    type: 'join',
    threadId: thread.id,
    channelId: interaction.channel.id,
    discordId: interaction.user.id,
    createdAt: Date.now()
  });
  audit('signup.ticket_created', {
    discordId: interaction.user.id,
    data: { threadId: thread.id }
  });
  await modLog(interaction.client, 'Join Ticket Created', [
    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Thread', value: `<#${thread.id}>`, inline: true }
  ]);

  await thread.send({
    content: [
      `<@${interaction.user.id}> welcome. If you applied through the SHD Support Portal, paste your application key here.`,
      'Application keys look like `SHD-APP-ABC123`.',
      'You need a rules key first. Generate it after reading the rules:',
      'https://lifesteal.shd-esports.com/rules',
      '',
      `Portal: ${config.supportPortalUrl.replace(/\/$/, '')}/signup`,
      '',
      'After submitting, send the `SHD-APP-...` key in this ticket. Staff review begins only after the key is verified.'
    ].join('\n')
  });
  await sendTicketCreatedNotices(interaction, {
    type: 'join',
    thread,
    details: [
      { name: 'Step', value: 'Waiting for portal application key', inline: true }
    ]
  });
  await interaction.editReply(`Join thread created: <#${thread.id}>`);
}

async function findUsableOpenTicket(interaction, type) {
  const existing = statements.findOpenTicketForUser.get(interaction.user.id, type);
  if (!existing) {
    return null;
  }

  const thread = await fetchTicketThread(interaction, existing.thread_id);
  if (thread?.isThread?.() && !thread.archived) {
    return existing;
  }

  statements.closeTicketThread.run(existing.thread_id);
  audit('ticket.stale_closed', {
    discordId: existing.discord_id,
    minecraftUuid: existing.minecraft_uuid,
    data: {
      type: existing.type,
      threadId: existing.thread_id,
      reason: thread?.archived ? 'thread_archived' : 'thread_missing'
    }
  });
  await modLog(interaction.client, 'Stale Ticket Record Closed', [
    { name: 'Type', value: existing.type, inline: true },
    { name: 'User', value: `<@${existing.discord_id}>`, inline: true },
    { name: 'Thread', value: `<#${existing.thread_id}>`, inline: true },
    { name: 'Reason', value: thread?.archived ? 'Thread archived' : 'Thread missing or deleted' }
  ]);
  return null;
}

async function fetchTicketThread(interaction, threadId) {
  const guildThread = await interaction.guild?.channels.fetch(threadId).catch(() => null);
  if (guildThread) {
    return guildThread;
  }
  return interaction.client.channels.fetch(threadId).catch(() => null);
}

async function createTicketThread(interaction, name) {
  const channel = interaction.channel;
  try {
    const thread = await channel.threads.create({
      name,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Ticket opened by ${interaction.user.tag}`
    });
    await thread.members.add(interaction.user.id).catch(() => null);
    await addStaffMembers(thread, interaction.guild);
    return thread;
  } catch (_error) {
    const thread = await channel.threads.create({
      name,
      type: ChannelType.PublicThread,
      reason: `Ticket opened by ${interaction.user.tag}`
    });
    await thread.members.add(interaction.user.id).catch(() => null);
    await addStaffMembers(thread, interaction.guild);
    return thread;
  }
}

async function sendTicketCreatedNotices(interaction, { type, thread, minecraftName = null, details = [] }) {
  const fields = [
    { name: 'Type', value: type, inline: true },
    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Thread', value: `<#${thread.id}>`, inline: true },
    { name: 'Minecraft', value: minecraftName ?? 'Not provided yet', inline: true },
    ...details
  ];

  const notificationChannel = await fetchTextChannel(interaction.client, config.ticketNotifyChannelId);
  if (notificationChannel) {
    const staffMentions = config.staffRoleIds.map((roleId) => `<@&${roleId}>`).join(' ');
    await notificationChannel.send({
      content: staffMentions || undefined,
      embeds: [ticketEmbed('New Ticket Created', 0x35b87f, fields)],
      components: [ticketLinkRow(interaction.guildId, thread.id)],
      allowedMentions: { roles: config.staffRoleIds }
    }).catch(() => null);
  }

  const archiveChannel = await fetchTextChannel(interaction.client, config.ticketArchiveChannelId);
  if (archiveChannel) {
    await archiveChannel.send({
      embeds: [ticketEmbed('Saved Ticket', 0x2f7d67, fields)],
      components: [ticketLinkRow(interaction.guildId, thread.id)]
    }).catch(() => null);
  }
}

async function fetchTextChannel(client, channelId) {
  if (!channelId) {
    return null;
  }
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased?.() ? channel : null;
}

function ticketEmbed(title, color, fields) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp(new Date());

  for (const field of fields) {
    if (!field.value) continue;
    embed.addFields({
      name: field.name,
      value: String(field.value).slice(0, 1024),
      inline: field.inline ?? false
    });
  }

  return embed;
}

function ticketLinkRow(guildId, threadId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Open Thread')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guildId}/${threadId}`)
  );
}

async function addStaffMembers(thread, guild) {
  if (!guild || config.staffRoleIds.length === 0) {
    return;
  }

  await guild.members.fetch().catch(() => null);
  const staffMembers = guild.members.cache.filter((member) =>
    config.staffRoleIds.some((roleId) => member.roles.cache.has(roleId))
  );

  for (const member of staffMembers.values()) {
    await thread.members.add(member.id).catch(() => null);
  }
}

function ticketStaffActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CLAIM_BUTTON_ID)
      .setLabel('Claim Review')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CLOSE_BUTTON_ID)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Secondary)
  );
}

function hasTicketStaffAccess(interaction) {
  return hasStaffAccess(interaction);
}

function safeThreadPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'ticket';
}

function identityBlock({ discordUser = null, shdId, minecraftName, minecraftUuid, extra = [] }) {
  return [
    discordUser ? `Discord Username: ${discordUser.tag ?? discordUser.username}` : null,
    discordUser ? `Discord User ID: ${discordUser.id}` : null,
    shdId ? `User SHD ID: ${shdId}` : null,
    minecraftName ? `Minecraft Name: ${minecraftName}` : null,
    minecraftUuid ? `Minecraft UUID: ${minecraftUuid}` : null,
    ...extra
  ].filter(Boolean).join('\n');
}
