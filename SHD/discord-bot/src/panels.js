import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, staffAuditLog, systemLog } from './logger.js';
import { hasStaffAccess } from './permissions.js';

const VERIFY_BUTTON_ID = 'shd:verify:accept';
const ROLE_BUTTON_PREFIX = 'shd:role:toggle:';

const roleOptions = [
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Roster updates, match posts, site news, and important SHD announcements.',
    style: ButtonStyle.Primary,
    roleId: () => config.roles.announcements
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Community nights, watch parties, special sessions, and event reminders.',
    style: ButtonStyle.Success,
    roleId: () => config.roles.events
  },
  {
    key: 'live',
    label: 'Live',
    description: 'Get pinged when linked SHD creators or players go live on Twitch.',
    style: ButtonStyle.Primary,
    roleId: () => config.roles.live
  },
  {
    key: 'supportPing',
    label: 'Support',
    description: 'Optional pings for support flow, ticket help, and staff-requested extra eyes.',
    style: ButtonStyle.Secondary,
    roleId: () => config.roles.supportPing
  }
];

export async function handleVerifyPanelCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to post verification panels.');
  }
  if (!config.roles.verified) {
    return interaction.editReply('Missing SHD_VERIFIED_ROLE_ID in the bot environment.');
  }

  const message = await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('SHD Verification')
      .setColor(0x2f7d67)
      .setDescription([
        'Accept the SHD community rules and unlock member access.',
        'Use this before opening support or project-specific tickets.'
      ].join('\n'))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(VERIFY_BUTTON_ID)
        .setLabel('Accept & Verify')
        .setStyle(ButtonStyle.Success)
    )]
  });

  statements.rolePanelMessages.create({
    type: 'verify',
    channelId: interaction.channel.id,
    messageId: message.id,
    createdBy: interaction.user.id
  });
  audit('panel.verify_created', {
    actorId: interaction.user.id,
    data: { channelId: interaction.channel.id, messageId: message.id, roleId: config.roles.verified }
  });
  await systemLog(interaction.client, 'SHD verify panel created', [
    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
  ]);
  return interaction.editReply('Verification panel posted.');
}

export async function handleRolePanelCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to post role panels.');
  }

  const configured = roleOptions.filter((option) => option.roleId());
  if (configured.length === 0) {
    return interaction.editReply('No public role IDs are configured yet.');
  }

  const message = await interaction.channel.send({
    embeds: [rolePanelEmbed(configured)],
    components: [roleButtonRow(configured)]
  });

  statements.rolePanelMessages.create({
    type: 'roles',
    channelId: interaction.channel.id,
    messageId: message.id,
    createdBy: interaction.user.id
  });
  audit('panel.roles_created', {
    actorId: interaction.user.id,
    data: { channelId: interaction.channel.id, messageId: message.id }
  });
  await systemLog(interaction.client, 'SHD role panel created', [
    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
  ]);
  return interaction.editReply('Role panel posted.');
}

export async function handlePanelInteraction(interaction) {
  if (!interaction.isButton()) return false;
  if (interaction.customId === VERIFY_BUTTON_ID) {
    await acceptVerification(interaction);
    return true;
  }
  if (interaction.customId.startsWith(ROLE_BUTTON_PREFIX)) {
    await toggleRole(interaction, interaction.customId.slice(ROLE_BUTTON_PREFIX.length));
    return true;
  }
  return false;
}

async function acceptVerification(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    return interaction.editReply('I could not find your server member profile. Please try again.');
  }
  if (!config.roles.verified) {
    return interaction.editReply('Verification is not configured yet. Please tell staff.');
  }

  if (!member.roles.cache.has(config.roles.verified)) {
    await member.roles.add(config.roles.verified, 'Accepted SHD verification panel');
  }
  if (config.roles.member && !member.roles.cache.has(config.roles.member)) {
    await member.roles.add(config.roles.member, 'Accepted SHD verification panel').catch(() => null);
  }

  statements.rulesAcceptances.upsert({
    discordId: interaction.user.id,
    type: 'shd_verify',
    roleId: config.roles.verified,
    source: 'verify_panel'
  });
  audit('verification.accepted', {
    actorId: interaction.user.id,
    data: { channelId: interaction.channelId, roleId: config.roles.verified }
  });
  await staffAuditLog(interaction.client, 'SHD verification accepted', [
    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Role', value: `<@&${config.roles.verified}>`, inline: true }
  ]);
  return interaction.editReply('Accepted. You now have SHD member access.');
}

async function toggleRole(interaction, key) {
  await interaction.deferReply({ ephemeral: true });
  const option = roleOptions.find((item) => item.key === key);
  const roleId = option?.roleId();
  if (!option || !roleId) {
    return interaction.editReply('That role option is not configured anymore.');
  }

  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    return interaction.editReply('I could not find your server member profile. Please try again.');
  }

  const enabled = !member.roles.cache.has(roleId);
  if (enabled) {
    await member.roles.add(roleId, `SHD role panel: ${option.label}`);
  } else {
    await member.roles.remove(roleId, `SHD role panel: ${option.label}`);
  }

  statements.roleAssignments.upsert({
    discordId: interaction.user.id,
    roleId,
    key,
    enabled
  });
  audit(enabled ? 'role.self_assigned' : 'role.self_removed', {
    actorId: interaction.user.id,
    data: { key, roleId, channelId: interaction.channelId }
  });
  return interaction.editReply(`${enabled ? 'Added' : 'Removed'} ${option.label}.`);
}

function roleButtonRow(options) {
  return new ActionRowBuilder().addComponents(
    ...options.slice(0, 5).map((option) =>
      new ButtonBuilder()
        .setCustomId(`${ROLE_BUTTON_PREFIX}${option.key}`)
        .setLabel(option.label)
        .setStyle(option.style)
    )
  );
}

function rolePanelEmbed(options) {
  const embed = new EmbedBuilder()
    .setTitle('SHD Notifications')
    .setColor(0xead49f)
    .setDescription([
      'Choose what you want to be pinged for in the SHD guild.',
      'These roles are optional, lightweight, and can be changed whenever your preferences change.'
    ].join('\n'))
    .setFooter({ text: 'Click a button again to remove that role.' });

  for (const option of options) {
    embed.addFields({
      name: option.label,
      value: option.description,
      inline: false
    });
  }

  return embed;
}
