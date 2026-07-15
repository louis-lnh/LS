import {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Look up a linked account')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Discord user to look up'))
    .addStringOption((option) =>
      option.setName('minecraft_name').setDescription('Minecraft username to look up')
    ),
  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Rules acceptance tools')
    .addSubcommand((subcommand) => subcommand.setName('version').setDescription('Show the current rules version'))
    .addSubcommand((subcommand) => subcommand.setName('accept').setDescription('Accept the current rules version'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('bump')
        .setDescription('Staff: bump the required rules version')
        .addStringOption((option) => option.setName('version').setDescription('New rules version').setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Create a ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Post a ticket panel')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Panel type')
            .setRequired(true)
            .addChoices(
              { name: 'Appeal', value: 'appeal' },
              { name: 'Join', value: 'join' },
              { name: 'Support', value: 'support' }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('whatsmyid')
    .setDescription('Show your SHD Lifesteal ID'),
  new SlashCommandBuilder()
    .setName('whoisid')
    .setDescription('Staff: look up a Lifesteal SHD ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((option) => option.setName('id').setDescription('SHD ID, for example SHD1234').setRequired(true)),
  new SlashCommandBuilder()
    .setName('confirm')
    .setDescription('Staff: confirm a Lifesteal join ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('discord-rules-panel')
    .setDescription('Post the Discord rules acceptance panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('lifesteal-rules-panel')
    .setDescription('Post the Lifesteal rules acceptance panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('lifesteal-roles-panel')
    .setDescription('Post the Lifesteal notification role panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('alts')
    .setDescription('Investigate likely alt accounts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Discord user to investigate'))
    .addStringOption((option) => option.setName('minecraft_name').setDescription('Minecraft username to investigate'))
    .addStringOption((option) => option.setName('iphash').setDescription('Full IP hash to investigate')),
  new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show a staff timeline for a linked account')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Discord user to inspect'))
    .addStringOption((option) => option.setName('minecraft_name').setDescription('Minecraft username to inspect')),
  new SlashCommandBuilder()
    .setName('note')
    .setDescription('Staff notes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a staff note to a linked account')
        .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true))
        .addStringOption((option) => option.setName('text').setDescription('Note text').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List staff notes for a linked account')
        .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a staff note')
        .addIntegerOption((option) => option.setName('id').setDescription('Note ID').setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Staff: approve an appeal ticket and unban the player')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('deny')
    .setDescription('Staff: deny the current ticket request')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((option) => option.setName('reason').setDescription('Optional denial note')),
  new SlashCommandBuilder()
    .setName('acknowledge')
    .setDescription('Staff: acknowledge a player report ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((option) => option
      .setName('action')
      .setDescription('What staff is doing with the report')
      .addChoices(
        { name: 'Acknowledged', value: 'acknowledged' },
        { name: 'Under Investigation', value: 'investigation' },
        { name: 'Temporary Ban Reported Player', value: 'temp_ban' },
        { name: 'Ban Reported Player', value: 'ban' }
      ))
    .addStringOption((option) => option.setName('duration').setDescription('Temp ban duration, for example 12h or 7d'))
    .addStringOption((option) => option.setName('reason').setDescription('Optional staff note')),
  new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('Staff: close the current ticket immediately')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Staff: add a Discord user to the current ticket thread')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('User to add to the ticket').setRequired(true)),
  new SlashCommandBuilder()
    .setName('sharedip')
    .setDescription('Manage approved shared-IP exceptions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('approve')
        .setDescription('Approve two users sharing an IP')
        .addUserOption((option) => option.setName('user').setDescription('First Discord user').setRequired(true))
        .addUserOption((option) => option.setName('other_user').setDescription('Second Discord user').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List shared-IP exceptions for a user')
        .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete, max 100')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a Discord member and optionally their Minecraft session')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) => option.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason'))
    .addBooleanOption((option) =>
      option.setName('minecraft').setDescription('Also kick the linked Minecraft account through RCON')
    ),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a Discord member and optionally their Minecraft account')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason'))
    .addBooleanOption((option) =>
      option.setName('minecraft').setDescription('Also ban the linked Minecraft account through RCON')
    ),
  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Disable a member link and remove whitelist if RCON is enabled')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Member to unlink').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder()
    .setName('notification')
    .setDescription('Create a notification preview for staff review')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((option) =>
      option.setName('title').setDescription('Notification title').setRequired(true).setMaxLength(120)
    )
    .addStringOption((option) =>
      option.setName('message').setDescription('Notification message. Use \\n for line breaks').setRequired(true).setMaxLength(2000)
    )
    .addStringOption((option) =>
      option
        .setName('style')
        .setDescription('Notification style')
        .addChoices(
          { name: 'Info', value: 'info' },
          { name: 'Success', value: 'success' },
          { name: 'Warning', value: 'warning' },
          { name: 'Danger', value: 'danger' },
          { name: 'Event', value: 'event' }
        )
    )
    .addStringOption((option) =>
      option.setName('footer').setDescription('Optional footer text').setMaxLength(120)
    )
    .addStringOption((option) =>
      option.setName('button_text').setDescription('Optional link button text').setMaxLength(80)
    )
    .addStringOption((option) =>
      option.setName('button_url').setDescription('Optional link button URL').setMaxLength(500)
    ),
  new SlashCommandBuilder()
    .setName('notification-publish')
    .setDescription('Publish a notification preview to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption((option) =>
      option.setName('id').setDescription('Notification preview ID').setRequired(true).setMinValue(1)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to publish into')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addRoleOption((option) => option.setName('role_1').setDescription('Role to notify'))
    .addRoleOption((option) => option.setName('role_2').setDescription('Additional role to notify'))
    .addRoleOption((option) => option.setName('role_3').setDescription('Additional role to notify'))
    .addRoleOption((option) => option.setName('role_4').setDescription('Additional role to notify'))
    .addRoleOption((option) => option.setName('role_5').setDescription('Additional role to notify')),
  new SlashCommandBuilder()
    .setName('data')
    .setDescription('Backup or export bot data')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('backup')
        .setDescription('Write a timestamped local data backup')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('export')
        .setDescription('Export a data collection as JSON')
        .addStringOption((option) =>
          option
            .setName('collection')
            .setDescription('Collection to export')
            .setRequired(true)
            .addChoices(
              { name: 'Linked accounts', value: 'linked_accounts' },
              { name: 'Audit events', value: 'audit_events' },
              { name: 'Moderation cases', value: 'moderation_cases' },
              { name: 'Appeals', value: 'appeals' },
              { name: 'Signup answers', value: 'signup_answers' },
              { name: 'Staff notes', value: 'staff_notes' },
              { name: 'Everything', value: 'all' }
            )
        )
    )
].map((command) => command.toJSON());

export const commandOptionType = ApplicationCommandOptionType;
