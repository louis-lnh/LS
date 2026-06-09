import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, appealLog, modLog, staffAuditLog, verifyLog } from './logger.js';
import { resolveMinecraftProfile } from './minecraft.js';
import { createVerification } from './verification.js';

const APPEAL_BUTTON_ID = 'ticket:appeal:open';
const JOIN_BUTTON_ID = 'ticket:join:open';
const CLOSE_BUTTON_ID = 'ticket:close';
const APPEAL_MODAL_ID = 'ticket:appeal:modal';
const CLOSE_MODAL_ID = 'ticket:close:modal';

const joinQuestions = [
  {
    key: 'minecraft_name',
    prompt: 'Question 1/7: What is your Minecraft Java username?'
  },
  {
    key: 'lifesteal_experience',
    prompt: 'Question 2/7: Have you ever played Lifesteal before?'
  },
  {
    key: 'found_server',
    prompt: 'Question 3/7: How did you find the server?'
  },
  {
    key: 'timezone',
    prompt: 'Question 4/7: What timezone or region are you in?'
  },
  {
    key: 'understands_pvp',
    prompt: 'Question 5/7: Do you understand this is a competitive PvP server? Answer yes or no.'
  },
  {
    key: 'rules_agreement',
    prompt: 'Question 6/7: Do you agree to follow the server rules? Answer yes or no.'
  },
  {
    key: 'extra',
    prompt: 'Question 7/7: Anything else staff should know? You can answer none.'
  }
];

export async function handlePanelCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const type = interaction.options.getString('type', true);
  if (!interaction.channel?.threads) {
    return interaction.editReply('This channel cannot create threads.');
  }

  const isAppeal = type === 'appeal';
  const embed = new EmbedBuilder()
    .setTitle(isAppeal ? 'Open an Appeal Ticket' : 'Apply to Join Lifesteal')
    .setColor(isAppeal ? 0xff5f56 : 0x35b87f)
    .setDescription(isAppeal
      ? 'Use this if you need staff to review a ban or punishment. You will enter your ban ID before the thread opens.'
      : 'Use this to start a signup thread. The bot will ask the signup questions one by one in the thread.');

  const button = new ButtonBuilder()
    .setCustomId(isAppeal ? APPEAL_BUTTON_ID : JOIN_BUTTON_ID)
    .setLabel(isAppeal ? 'Open Appeal' : 'Start Join Ticket')
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
    components: [closeButtonRow()]
  });
  return true;
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
    components: [closeButtonRow()]
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
    content: `<@${interaction.user.id}> ${joinQuestions[0].prompt}`,
    components: [closeButtonRow()]
  });
  await sendTicketCreatedNotices(interaction, {
    type: 'join',
    thread,
    details: [
      { name: 'Step', value: 'Question 1/7 started', inline: true }
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

function closeButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CLOSE_BUTTON_ID)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Secondary)
  );
}

function hasTicketStaffAccess(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    return true;
  }
  return config.staffRoleIds.some((roleId) => interaction.member?.roles?.cache?.has(roleId));
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
