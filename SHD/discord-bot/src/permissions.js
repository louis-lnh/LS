import { PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';

function hasAnyRole(member, roleIds) {
  return roleIds.some((roleId) => member?.roles?.cache?.has(roleId));
}

export function isOwner(userId) {
  return config.owners.discordIds.includes(userId);
}

export function hasStaffAccess(interaction) {
  if (isOwner(interaction.user.id)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  return hasAnyRole(interaction.member, [
    ...config.roles.staff,
    ...config.roles.admins,
    ...config.roles.moderators,
    ...config.roles.support,
    ...config.roles.developers
  ]);
}

export function hasAdminAccess(interaction) {
  if (isOwner(interaction.user.id)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  return hasAnyRole(interaction.member, [...config.roles.admins, ...config.roles.developers]);
}

export function missingPermissionMessage(action) {
  return `You do not have permission to ${action}.`;
}
