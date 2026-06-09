import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { config } from './config.js';
import { audit, modLog, verifyLog } from './logger.js';

const DISCORD_RULES_BUTTON_ID = 'rules:discord:accept';
const LIFESTEAL_RULES_BUTTON_ID = 'rules:lifesteal:accept';

const panelConfigs = {
  discord: {
    title: 'Discord Rules',
    description: [
      'Read the Discord server rules above.',
      'Press the button below to confirm you accept them and unlock the server member role.'
    ].join('\n'),
    buttonLabel: 'Accept Discord Rules',
    buttonId: DISCORD_RULES_BUTTON_ID,
    roleId: () => config.discordRulesRoleId,
    auditType: 'rules.discord_accepted',
    logTitle: 'Discord Rules Accepted'
  },
  lifesteal: {
    title: 'Lifesteal Rules',
    description: [
      'Read the Lifesteal rules above before joining gameplay channels.',
      'Press the button below to confirm you accept them and unlock the Lifesteal member role.'
    ].join('\n'),
    buttonLabel: 'Accept Lifesteal Rules',
    buttonId: LIFESTEAL_RULES_BUTTON_ID,
    roleId: () => config.lifestealRulesRoleId,
    auditType: 'rules.lifesteal_accepted',
    logTitle: 'Lifesteal Rules Accepted'
  }
};

export async function handleRulesPanelCommand(interaction, type) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('You do not have permission to post rules panels.');
  }

  const panel = panelConfigs[type];
  const roleId = panel.roleId();
  if (!roleId) {
    return interaction.editReply(`Missing role config for this panel. Add ${type === 'discord' ? 'DISCORD_RULES_ROLE_ID' : 'LIFESTEAL_RULES_ROLE_ID'} to .env.`);
  }

  await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle(panel.title)
      .setColor(type === 'discord' ? 0x5865f2 : 0x35b87f)
      .setDescription(panel.description)],
    components: [rulesButtonRow(panel.buttonId, panel.buttonLabel)]
  });

  audit(`rules.${type}_panel_created`, {
    discordId: interaction.user.id,
    data: { channelId: interaction.channel.id, roleId }
  });
  await modLog(interaction.client, `${panel.title} Panel Created`, [
    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
    { name: 'Role', value: `<@&${roleId}>`, inline: true },
    { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true }
  ]);
  return interaction.editReply(`${panel.title} panel posted.`);
}

export async function handleRulesPanelInteraction(interaction) {
  if (!interaction.isButton()) {
    return false;
  }

  const type = Object.keys(panelConfigs).find((key) => panelConfigs[key].buttonId === interaction.customId);
  if (!type) {
    return false;
  }

  const panel = panelConfigs[type];
  const roleId = panel.roleId();
  await interaction.deferReply({ ephemeral: true });

  if (!roleId) {
    return interaction.editReply('This rules panel is not configured yet. Please tell staff.');
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    return interaction.editReply('I could not find your server member profile. Please try again.');
  }

  if (!member.roles.cache.has(roleId)) {
    await member.roles.add(roleId, `${panel.title} accepted`).catch((error) => {
      throw new Error(`Could not add the role. Check my role permissions and hierarchy. ${error.message}`);
    });
  }

  audit(panel.auditType, {
    discordId: interaction.user.id,
    data: { roleId, channelId: interaction.channelId }
  });
  await verifyLog(interaction.client, panel.logTitle, [
    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Role', value: `<@&${roleId}>`, inline: true },
    { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }
  ]);
  return interaction.editReply(`Accepted. You now have the ${panel.title.toLowerCase()} role.`);
}

function rulesButtonRow(customId, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Success)
  );
}
