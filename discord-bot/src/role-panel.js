import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { config } from './config.js';
import { audit, modLog } from './logger.js';
import { hasStaffAccess } from './permissions.js';

const ROLE_BUTTON_PREFIX = 'lifesteal:role:toggle:';

const roleOptions = [
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Season news, important staff posts, release notes, and server-wide notices.',
    style: ButtonStyle.Primary,
    roleId: () => config.notificationRoleIds.announcements
  },
  {
    key: 'ingame',
    label: 'In-Game',
    description: 'Lifesteal gameplay updates, server-state notices, restarts, and urgent in-game information.',
    style: ButtonStyle.Success,
    roleId: () => config.notificationRoleIds.ingame
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Event reminders, objective windows, End opening posts, and special Lifesteal sessions.',
    style: ButtonStyle.Secondary,
    roleId: () => config.notificationRoleIds.events
  }
];

export async function handleRolePanelCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasStaffAccess(interaction)) {
    return interaction.editReply('You do not have permission to post role panels.');
  }
  const configured = roleOptions.filter((option) => option.roleId());
  if (configured.length === 0) {
    return interaction.editReply('No Lifesteal notification role IDs are configured yet.');
  }

  await interaction.channel.send({
    embeds: [rolePanelEmbed(configured)],
    components: [roleButtonRow(configured)]
  });

  audit('panel.roles_created', {
    discordId: interaction.user.id,
    data: { channelId: interaction.channel.id, roles: configured.map((option) => option.key) }
  });
  await modLog(interaction.client, 'Lifesteal Role Panel Created', [
    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Roles', value: configured.map((option) => `<@&${option.roleId()}>`).join(', ') },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
  ]);
  return interaction.editReply('Lifesteal notification role panel posted.');
}

export async function handleRolePanelInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith(ROLE_BUTTON_PREFIX)) {
    return false;
  }

  await interaction.deferReply({ ephemeral: true });
  const key = interaction.customId.slice(ROLE_BUTTON_PREFIX.length);
  const option = roleOptions.find((item) => item.key === key);
  const roleId = option?.roleId();
  if (!option || !roleId) {
    return interaction.editReply('That Lifesteal notification role is not configured anymore. Please tell staff.');
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    return interaction.editReply('I could not find your server member profile. Please try again.');
  }

  const enabled = !member.roles.cache.has(roleId);
  if (enabled) {
    await member.roles.add(roleId, `Lifesteal role panel: ${option.label}`);
  } else {
    await member.roles.remove(roleId, `Lifesteal role panel: ${option.label}`);
  }

  audit(enabled ? 'role.self_assigned' : 'role.self_removed', {
    discordId: interaction.user.id,
    data: {
      key,
      roleId,
      channelId: interaction.channelId
    }
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
    .setTitle('Lifesteal Notifications')
    .setColor(0xead49f)
    .setDescription([
      'Choose what you want to be pinged for during the Lifesteal season.',
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
