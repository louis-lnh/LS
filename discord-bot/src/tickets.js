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
import { audit, appealLog, logToChannel, modLog, staffAuditLog, verifyLog } from './logger.js';
import { resolveMinecraftProfile } from './minecraft.js';
import { hasStaffAccess } from './permissions.js';
import { createVerification } from './verification.js';

const APPEAL_BUTTON_ID = 'ticket:appeal:open';
const JOIN_BUTTON_ID = 'ticket:join:open';
const CLOSE_BUTTON_ID = 'ticket:close';
const CLAIM_BUTTON_ID = 'ticket:claim';
const APPEAL_MODAL_ID = 'ticket:appeal:modal';
const CLOSE_MODAL_ID = 'ticket:close:modal';
const APPLICATION_CODE_PATTERN = /\bSHD-APP-[A-Z0-9]{4,12}\b/i;

const joinQuestions = [
  {
    key: 'minecraft_name',
    prompt: 'Question 1/7: What is your exact Minecraft Java username?'
  },
  {
    key: 'lifesteal_experience',
    prompt: 'Question 2/7: Tell us about your Lifesteal, SMP, survival, or PvP experience.'
  },
  {
    key: 'found_server',
    prompt: 'Question 3/7: How did you find SHD Lifesteal?'
  },
  {
    key: 'timezone',
    prompt: 'Question 4/7: What region and timezone are you in?'
  },
  {
    key: 'understands_pvp',
    prompt: 'Question 5/7: Do you understand this is a competitive PvP Lifesteal server? Answer yes or no.'
  },
  {
    key: 'rules_agreement',
    prompt: 'Question 6/7: Have you read and accepted the current Lifesteal rules? Answer yes or no.'
  },
  {
    key: 'extra',
    prompt: 'Question 7/7: Anything else staff should know, such as team plans, content links, or availability? You can answer none.'
  }
];

export async function handlePanelCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const type = interaction.options.getString('type', true);
  if (!interaction.channel?.threads) {
    return interaction.editReply('This channel cannot create threads.');
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
    .setLabel(isAppeal ? 'Open Appeal Ticket' : 'Open Application Ticket')
    .setStyle(isAppeal ? ButtonStyle.Danger : ButtonStyle.Primary);

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
      return showAppealModal(interaction);
    }
    if (interaction.customId === JOIN_BUTTON_ID) {
      return openJoinTicket(interaction);
    }
    if (interaction.customId === CLOSE_BUTTON_ID) {
      return showCloseTicketModal(interaction);
    }
    if (interaction.customId === CLAIM_BUTTON_ID) {
      return claimTicket(interaction);
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === APPEAL_MODAL_ID) {
    return openAppealTicket(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === CLOSE_MODAL_ID) {
    return closeTicket(interaction);
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

  const question = joinQuestions[ticket.step];
  if (!question) {
    return false;
  }

  const answer = message.content.trim();
  if (!answer) {
    await message.reply('Please answer with text.');
    return true;
  }

  const answers = { ...ticket.answers };
  let minecraftUuid = ticket.minecraft_uuid;
  let minecraftName = ticket.minecraft_name;

  if (question.key === 'minecraft_name') {
    try {
      const profile = await resolveMinecraftProfile(answer);
      minecraftUuid = profile.uuid;
      minecraftName = profile.name;
      answers[question.key] = profile.name;
    } catch (error) {
      await message.reply(`I could not find that Minecraft account: ${error.message}\nPlease send the username again.`);
      return true;
    }
  } else if (question.key === 'understands_pvp' || question.key === 'rules_agreement') {
    const parsed = parseYesNo(answer);
    if (parsed == null) {
      await message.reply('Please answer yes or no.');
      return true;
    }
    answers[question.key] = parsed;
  } else {
    answers[question.key] = answer;
  }

  const nextStep = ticket.step + 1;
  statements.updateTicketThread.run({
    threadId: message.channel.id,
    step: nextStep,
    answers,
    minecraftUuid,
    minecraftName
  });

  if (nextStep < joinQuestions.length) {
    await message.channel.send(joinQuestions[nextStep].prompt);
    return true;
  }

  statements.upsertSignupAnswers.run({
    discordId: ticket.discord_id,
    minecraftUuid,
    minecraftName,
    lifestealExperience: answers.lifesteal_experience ?? '',
    foundServer: answers.found_server ?? '',
    timezone: answers.timezone ?? '',
    understandsPvp: Boolean(answers.understands_pvp),
    rulesAgreement: Boolean(answers.rules_agreement),
    extra: answers.extra ?? '',
    submittedAt: Date.now()
  });

  audit('signup.ticket_completed', {
    discordId: ticket.discord_id,
    minecraftUuid,
    data: { threadId: message.channel.id, minecraftName }
  });
  await modLog(message.client, 'Join Ticket Completed', [
    { name: 'User', value: `<@${ticket.discord_id}>`, inline: true },
    { name: 'Minecraft', value: minecraftName ?? 'Unknown', inline: true },
    { name: 'Thread', value: `<#${message.channel.id}>`, inline: true }
  ]);

  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('Signup Answers Submitted')
      .setColor(0x35b87f)
      .setDescription([
        `Discord: <@${ticket.discord_id}>`,
        `Minecraft: ${minecraftName ?? 'Unknown'}`,
        `Experience: ${answers.lifesteal_experience ?? 'Not answered'}`,
        `Found server: ${answers.found_server ?? 'Not answered'}`,
        `Timezone: ${answers.timezone ?? 'Not answered'}`,
        `Understands PvP: ${answers.understands_pvp ? 'Yes' : 'No'}`,
        `Rules agreement: ${answers.rules_agreement ? 'Yes' : 'No'}`,
        `Extra: ${answers.extra ?? 'None'}`
      ].join('\n'))]
  });

  if (answers.rules_agreement) {
    const verification = createVerification(ticket.discord_id, { uuid: minecraftUuid, name: minecraftName });
    await message.channel.send([
      `<@${ticket.discord_id}> signup is saved. Finish verification here:`,
      verification.url,
      '',
      `When the Minecraft bridge is installed, you can also run: /link ${verification.linkCode}`
    ].join('\n'));
    await verifyLog(message.client, 'Join Ticket Verification Link Created', [
      { name: 'User', value: `<@${ticket.discord_id}>`, inline: true },
      { name: 'Minecraft', value: minecraftName ?? 'Unknown', inline: true },
      { name: 'Thread', value: `<#${message.channel.id}>`, inline: true }
    ]);
  } else {
    await message.channel.send('Signup answers are saved, but rules were not accepted. Staff should review before verification.');
  }

  await message.channel.send({
    content: 'Staff can review this thread now.',
    components: [ticketStaffActionRow()]
  });
  return true;
}

async function handleApplicationCodeMessage(message) {
  const match = message.content.match(APPLICATION_CODE_PATTERN);
  if (!match) {
    return false;
  }

  const code = match[0].toUpperCase();
  const application = statements.findSupportApplicationByCode.get(code);
  if (!application) {
    await message.reply('I could not find an application with that code. Check the code and send it again.');
    return true;
  }

  if (application.status !== 'submitted') {
    if (application.discord_id_verified === message.author.id) {
      await message.reply('This application is already verified for this Discord account. Staff can review it.');
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
    embeds: [ticketEmbed('Staff Review Ready', 0xf2c94c, supportApplicationFields(updated, [
      { name: 'Applicant', value: `<@${message.author.id}>`, inline: true },
      { name: 'Approve', value: `/approve application_code:${updated.code}`, inline: false },
      { name: 'Review Note', value: 'Claim the ticket before reviewing so staff do not duplicate work.' }
    ]))],
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

function showCloseTicketModal(interaction) {
  if (!hasTicketStaffAccess(interaction)) {
    return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
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

  const reason = interaction.fields.getTextInputValue('reason').trim();
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
  await interaction.editReply('Ticket closed.');
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
    step: 0,
    answers: {},
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
      `If you cannot use the portal, answer here instead: ${joinQuestions[0].prompt}`
    ].join('\n'),
    components: [ticketStaffActionRow()]
  });
  await sendTicketCreatedNotices(interaction, {
    type: 'join',
    thread,
    details: [
      { name: 'Step', value: 'Waiting for portal application key or fallback question 1/7', inline: true }
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

function parseYesNo(value) {
  const normalized = value.trim().toLowerCase();
  if (['yes', 'y', 'true', 'yeah', 'yep'].includes(normalized)) return true;
  if (['no', 'n', 'false', 'nah', 'nope'].includes(normalized)) return false;
  return null;
}

function safeThreadPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'ticket';
}
