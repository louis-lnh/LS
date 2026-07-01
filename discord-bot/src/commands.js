import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your Discord account to your Minecraft account')
    .addStringOption((option) =>
      option
        .setName('minecraft_name')
        .setDescription('Your Minecraft Java username')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Look up a linked account')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Discord user to look up'))
    .addStringOption((option) =>
      option.setName('minecraft_name').setDescription('Minecraft username to look up')
    ),
  new SlashCommandBuilder()
    .setName('risk')
    .setDescription('Show a linked account risk score')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Discord user to check'))
    .addStringOption((option) => option.setName('minecraft_name').setDescription('Minecraft username to check')),
  new SlashCommandBuilder()
    .setName('risklist')
    .setDescription('List linked accounts at or above a risk score')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption((option) =>
      option.setName('threshold').setDescription('Minimum risk score').setRequired(true).setMinValue(0).setMaxValue(200)
    ),
  new SlashCommandBuilder()
    .setName('signup')
    .setDescription('Submit or view Lifesteal signup context')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('submit')
        .setDescription('Submit your Lifesteal signup answers')
        .addStringOption((option) => option.setName('minecraft_name').setDescription('Minecraft username'))
        .addStringOption((option) => option.setName('experience').setDescription('Have you played Lifesteal before?'))
        .addStringOption((option) => option.setName('found_server').setDescription('How did you find the server?'))
        .addStringOption((option) => option.setName('timezone').setDescription('Timezone or region'))
        .addBooleanOption((option) => option.setName('understands_pvp').setDescription('You understand this is competitive PvP'))
        .addBooleanOption((option) => option.setName('agree_rules').setDescription('You agree to the rules'))
        .addStringOption((option) => option.setName('extra').setDescription('Optional extra context'))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('View signup answers')
        .addUserOption((option) => option.setName('user').setDescription('Staff: user to view'))
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
    .setName('profile')
    .setDescription('View or update Lifesteal profile/event data')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Update your profile data')
        .addStringOption((option) => option.setName('region').setDescription('Region or timezone'))
        .addStringOption((option) => option.setName('team').setDescription('Team name'))
        .addStringOption((option) => option.setName('event_interest').setDescription('Event interest'))
        .addBooleanOption((option) => option.setName('public_stats').setDescription('Opt into public stats later'))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View profile data')
        .addUserOption((option) => option.setName('user').setDescription('Staff: user to view'))
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
              { name: 'Join', value: 'join' }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('discord-rules-panel')
    .setDescription('Post the Discord rules acceptance panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('lifesteal-rules-panel')
    .setDescription('Post the Lifesteal rules acceptance panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Create or manage appeals')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create an appeal')
        .addStringOption((option) => option.setName('reason').setDescription('Appeal reason').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('close')
        .setDescription('Staff: close an appeal')
        .addIntegerOption((option) => option.setName('id').setDescription('Appeal ID').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Close reason'))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('accept')
        .setDescription('Staff: accept an appeal')
        .addIntegerOption((option) => option.setName('id').setDescription('Appeal ID').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Decision reason'))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deny')
        .setDescription('Staff: deny an appeal')
        .addIntegerOption((option) => option.setName('id').setDescription('Appeal ID').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Decision reason'))
    ),
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
    .setDescription('Approve a linked member or portal application')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Linked Discord user to approve'))
    .addStringOption((option) => option
      .setName('application_code')
      .setDescription('Portal application awaiting review')
      .setAutocomplete(true))
    .addStringOption((option) => option.setName('reason').setDescription('Approval reason')),
  new SlashCommandBuilder()
    .setName('deny')
    .setDescription('Deny a linked member or portal application')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Linked Discord user to deny'))
    .addStringOption((option) => option
      .setName('application_code')
      .setDescription('Portal application awaiting review')
      .setAutocomplete(true))
    .addStringOption((option) => option.setName('reason').setDescription('Denial reason')),
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
    .setName('case')
    .setDescription('Staff case tools')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('close')
        .setDescription('Close a moderation case')
        .addIntegerOption((option) => option.setName('id').setDescription('Case ID').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Close reason'))
    ),
  new SlashCommandBuilder()
    .setName('flag')
    .setDescription('Flag or clear a linked member as suspicious')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true))
    .addBooleanOption((option) =>
      option.setName('suspicious').setDescription('Whether the member should be flagged').setRequired(true)
    )
    .addStringOption((option) => option.setName('reason').setDescription('Reason')),
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
    .setDescription('Send a staff notification embed in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((option) =>
      option.setName('title').setDescription('Notification title').setRequired(true).setMaxLength(120)
    )
    .addStringOption((option) =>
      option.setName('message').setDescription('Notification message').setRequired(true).setMaxLength(2000)
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
    ),
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
