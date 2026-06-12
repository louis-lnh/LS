import { PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';

export function hasStaffAccess(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    return true;
  }

  return hasConfiguredStaffRole(interaction);
}

export function hasConfiguredStaffRole(interaction) {
  return config.staffRoleIds.some((roleId) => interaction.member?.roles?.cache?.has(roleId));
}

export function hasStaffOrPermission(interaction, permission) {
  return hasStaffAccess(interaction) || interaction.memberPermissions?.has(permission);
}

export function hasSensitiveDataAccess(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

export function missingPermissionMessage(label) {
  return `You do not have permission to ${label}.`;
}
