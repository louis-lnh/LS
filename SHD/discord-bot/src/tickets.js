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
import { audit, logToChannel, staffAuditLog } from './logger.js';
import { hasStaffAccess } from './permissions.js';

const PANEL_BUTTON_PREFIX = 'shd:ticket:open:';
const CLAIM_BUTTON_ID = 'shd:ticket:claim';
const CLOSE_BUTTON_ID = 'shd:ticket:close';
const CLOSE_MODAL_ID = 'shd:ticket:close-modal';
const SUBMISSION_CODE_PATTERN = /\bSHD-(?:CON|APP|APL|RPT|SUP)-[A-F0-9]{8}\b/i;

const ticketTypes = {
  support: {
    label: 'Support',
    color: 0x2f7d67,
    codeTypes: ['support', 'contact'],
    description: 'Open a support ticket and paste your SHD support key if you already submitted a form.'
  },
  application: {
    label: 'Application',
    color: 0x35b87f,
    codeTypes: ['application'],
    description: 'Open an application review ticket and paste your SHD-APP key.'
  },
  appeal: {
    label: 'Appeal',
    color: 0xffb020,
    codeTypes: ['appeal'],
    description: 'Open an appeal ticket and paste your SHD-APL key.'
  },
  report: {
    label: 'Report',
    color: 0xff5f56,
    codeTypes: ['report'],
    description: 'Open a private report ticket and paste your SHD-RPT key.'
  },
  partnership: {
    label: 'Partnership',
    color: 0x5865f2,
    codeTypes: ['contact', 'support'],
    description: 'Open a partnership or collaboration ticket and paste your support key if you have one.'
  }
};

export const ticketTypeChoices = Object.entries(ticketTypes).map(([value, item]) => ({
  name: item.label,
  value
}));

export async function handleTicketPanelCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to post ticket panels.');
  }

  const type = interaction.options.getString('type', true);
  const ticketType = ticketTypes[type];
  if (!ticketType) {
    return interaction.editReply('Unknown ticket panel type.');
  }
  if (!interaction.channel?.threads) {
    return interaction.editReply('This channel cannot create threads.');
  }

  await interaction.channel.send({
    embeds: [ticketPanelEmbed(type, ticketType)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${PANEL_BUTTON_PREFIX}${type}`)
        .setLabel(`Open ${ticketType.label} Ticket`)
        .setStyle(type === 'report' || type === 'appeal' ? ButtonStyle.Danger : ButtonStyle.Primary)
    )]
  });

  audit('ticket.panel_created', {
    actorId: interaction.user.id,
    data: { type, channelId: interaction.channel.id }
  });
  await staffAuditLog(interaction.client, 'SHD ticket panel created', [
    { name: 'Type', value: ticketType.label, inline: true },
    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
  ]);
  return interaction.editReply(`${ticketType.label} ticket panel posted.`);
}

export async function handleTicketInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith(PANEL_BUTTON_PREFIX)) {
      await openTicket(interaction, interaction.customId.slice(PANEL_BUTTON_PREFIX.length));
      return true;
    }
    if (interaction.customId === CLAIM_BUTTON_ID) {
      await claimTicket(interaction);
      return true;
    }
    if (interaction.customId === CLOSE_BUTTON_ID) {
      await showCloseModal(interaction);
      return true;
    }
  }
  if (interaction.isModalSubmit() && interaction.customId === CLOSE_MODAL_ID) {
    await closeTicket(interaction);
    return true;
  }
  return false;
}

export async function handleTicketMessage(message) {
  if (message.author.bot || !message.channel?.isThread?.()) {
    return false;
  }

  const match = message.content.match(SUBMISSION_CODE_PATTERN);
  if (!match) return false;

  const ticket = statements.ticketThreads.findOpenByThread(message.channel.id);
  if (!ticket) return false;
  if (ticket.discord_id !== message.author.id) {
    await message.reply('Only the member who opened this ticket can attach a support key.');
    return true;
  }
  await attachSubmissionCode(message, match[0].toUpperCase(), ticket);
  return true;
}

async function openTicket(interaction, type) {
  await interaction.deferReply({ ephemeral: true });
  const ticketType = ticketTypes[type];
  if (!ticketType) {
    return interaction.editReply('Unknown ticket type.');
  }
  if (!interaction.channel?.threads) {
    return interaction.editReply('This channel cannot create threads.');
  }

  const existing = await findUsableOpenTicket(interaction, type);
  if (existing) {
    return interaction.editReply(`You already have an open ${ticketType.label.toLowerCase()} ticket: <#${existing.thread_id}>`);
  }

  const thread = await createTicketThread(interaction, `${type}-${safeThreadPart(interaction.user.username)}`);
  statements.ticketThreads.create({
    type,
    threadId: thread.id,
    channelId: interaction.channel.id,
    discordId: interaction.user.id
  });
  audit('ticket.created', {
    actorId: interaction.user.id,
    data: { type, threadId: thread.id, channelId: interaction.channel.id }
  });

  await thread.send({
    content: `<@${interaction.user.id}>`,
    embeds: [new EmbedBuilder()
      .setTitle(`${ticketType.label} Ticket`)
      .setColor(ticketType.color)
      .setDescription([
        ticketType.description,
        '',
        'If you submitted a website form, paste your key here.',
        'Staff can claim or close this ticket with the controls below.'
      ].join('\n'))],
    components: [ticketActionRow()]
  });
  await sendTicketNotice(interaction.client, interaction.guildId, thread.id, ticketType, interaction.user.id);
  return interaction.editReply(`${ticketType.label} ticket created: <#${thread.id}>`);
}

async function attachSubmissionCode(message, code, ticket) {
  const submission = statements.supportSubmissions.get(code);
  if (!submission) {
    await message.reply('I could not find a support submission with that key. Check the code and paste it again.');
    return;
  }
  const ticketType = ticketTypes[ticket.type];
  if (ticketType?.codeTypes?.length && !ticketType.codeTypes.includes(submission.form_type)) {
    await message.reply(`That key is for ${submission.form_type}, but this is a ${ticketType.label.toLowerCase()} ticket.`);
    return;
  }
  if (submission.discord_id && submission.discord_id !== message.author.id) {
    await message.reply('That support key belongs to a different Discord ID. Staff can help if the form was submitted incorrectly.');
    return;
  }
  if (submission.ticket_thread_id && submission.ticket_thread_id !== message.channel.id) {
    await message.reply(`That support key is already attached to <#${submission.ticket_thread_id}>.`);
    return;
  }

  const updated = statements.supportSubmissions.attachTicket(code, message.channel.id);
  statements.ticketThreads.attachSubmission(message.channel.id, code);
  audit('ticket.submission_attached', {
    actorId: message.author.id,
    targetId: code,
    data: { threadId: message.channel.id, formType: updated.form_type }
  });

  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('Submission Key Verified')
      .setColor(0x35b87f)
      .addFields(
        { name: 'Code', value: updated.code, inline: true },
        { name: 'Type', value: updated.form_type, inline: true },
        { name: 'Priority', value: updated.priority, inline: true },
        { name: 'Subject', value: updated.subject }
      )],
    components: [ticketActionRow()]
  });
  await staffAuditLog(message.client, 'SHD submission attached to ticket', [
    { name: 'Code', value: updated.code, inline: true },
    { name: 'Thread', value: `<#${message.channel.id}>`, inline: true },
    { name: 'User', value: `<@${message.author.id}>`, inline: true }
  ]);
}

function showCloseModal(interaction) {
  if (!hasStaffAccess(interaction)) {
    return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(CLOSE_MODAL_ID)
    .setTitle('Close SHD Ticket');
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
  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('Only staff can close tickets.');
  }
  if (!interaction.channel?.isThread?.()) {
    return interaction.editReply('This can only be used inside a ticket thread.');
  }

  const reason = interaction.fields.getTextInputValue('reason').trim();
  const ticket = statements.ticketThreads.close(interaction.channel.id, reason, interaction.user.id);
  if (!ticket) {
    return interaction.editReply('No open ticket record found for this thread.');
  }
  audit('ticket.closed', {
    actorId: interaction.user.id,
    targetId: ticket.submission_code,
    data: { threadId: interaction.channel.id, type: ticket.type, reason }
  });
  await interaction.channel.send(`Ticket closed by <@${interaction.user.id}>: ${reason}`);
  await interaction.channel.setArchived(true, reason).catch(() => null);
  await staffAuditLog(interaction.client, 'SHD ticket closed', [
    { name: 'Thread', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Reason', value: reason }
  ]);
  return interaction.editReply('Ticket closed.');
}

async function claimTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('Only staff can claim tickets.');
  }
  if (!interaction.channel?.isThread?.()) {
    return interaction.editReply('This can only be used inside a ticket thread.');
  }

  const result = statements.ticketThreads.claim(interaction.channel.id, interaction.user.id);
  if (!result.ok && result.reason === 'claimed') {
    return interaction.editReply(`This ticket is already claimed by <@${result.ticket.claimed_by}>.`);
  }
  if (!result.ok) {
    return interaction.editReply('No open ticket record found for this thread.');
  }
  if (result.ticket.submission_code) {
    statements.supportSubmissions.claim(result.ticket.submission_code, interaction.user.id);
  }
  if (!result.changed) {
    return interaction.editReply('You already own this ticket.');
  }

  audit('ticket.claimed', {
    actorId: interaction.user.id,
    targetId: result.ticket.submission_code,
    data: { threadId: interaction.channel.id, type: result.ticket.type }
  });
  await interaction.channel.send(`Review claimed by <@${interaction.user.id}>.`);
  await staffAuditLog(interaction.client, 'SHD ticket claimed', [
    { name: 'Thread', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
  ]);
  return interaction.editReply('Ticket claimed.');
}

async function findUsableOpenTicket(interaction, type) {
  const existing = statements.ticketThreads.findOpenForUser(interaction.user.id, type);
  if (!existing) return null;
  const thread = await interaction.guild?.channels.fetch(existing.thread_id).catch(() => null);
  if (thread?.isThread?.() && !thread.archived) return existing;

  statements.ticketThreads.close(existing.thread_id, 'Stale ticket thread missing or archived', 'system');
  audit('ticket.stale_closed', {
    actorId: existing.discord_id,
    data: { type, threadId: existing.thread_id }
  });
  return null;
}

async function createTicketThread(interaction, name) {
  try {
    const thread = await interaction.channel.threads.create({
      name,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `SHD ticket opened by ${interaction.user.tag}`
    });
    await thread.members.add(interaction.user.id).catch(() => null);
    return thread;
  } catch (_error) {
    const thread = await interaction.channel.threads.create({
      name,
      type: ChannelType.PublicThread,
      reason: `SHD ticket opened by ${interaction.user.tag}`
    });
    await thread.members.add(interaction.user.id).catch(() => null);
    return thread;
  }
}

async function sendTicketNotice(client, guildId, threadId, ticketType, userId) {
  await logToChannel(client, config.channels.ticketNotify || config.channels.supportLog, 'New SHD ticket created', [
    { name: 'Type', value: ticketType.label, inline: true },
    { name: 'User', value: `<@${userId}>`, inline: true },
    { name: 'Thread', value: `<#${threadId}>`, inline: true },
    { name: 'Open', value: `https://discord.com/channels/${guildId}/${threadId}` }
  ]);
}

function ticketPanelEmbed(type, ticketType) {
  return new EmbedBuilder()
    .setTitle(`${ticketType.label} Tickets`)
    .setColor(ticketType.color)
    .setDescription([
      ticketType.description,
      '',
      'Website keys are attached inside the ticket after the thread opens.'
    ].join('\n'))
    .setFooter({ text: `SHD ticket type: ${type}` });
}

function ticketActionRow() {
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

function safeThreadPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'member';
}
