import { EmbedBuilder } from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';

export function audit(type, values = {}) {
  statements.addAudit.run({
    type,
    discordId: values.discordId ?? null,
    minecraftUuid: values.minecraftUuid ?? null,
    ipHash: values.ipHash ?? null,
    dataJson: JSON.stringify(values.data ?? {}),
    createdAt: Date.now()
  });
}

export async function logToChannel(client, channelId, title, fields = []) {
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch((error) => {
    console.warn(`Could not fetch log channel ${channelId} for "${title}": ${error.message}`);
    return null;
  });
  if (!channel?.isTextBased()) {
    console.warn(`Configured log channel ${channelId} for "${title}" is missing or not text-based.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x2f7d67)
    .setTimestamp(new Date());

  for (const field of fields) {
    if (!field.value) continue;
    embed.addFields({
      name: field.name,
      value: String(field.value).slice(0, 1024),
      inline: field.inline ?? false
    });
  }

  await channel.send({ embeds: [embed] }).catch((error) => {
    console.warn(`Could not send log message "${title}" to ${channelId}: ${error.message}`);
  });
}

export async function modLog(client, title, fields = []) {
  await logToChannel(client, config.modLogChannelId, title, fields);
}

export async function verifyLog(client, title, fields = []) {
  await logToChannel(client, config.verifyLogChannelId, title, fields);
}

export async function securityLog(client, title, fields = []) {
  await logToChannel(client, config.securityLogChannelId || config.modLogChannelId, title, fields);
}

export async function minecraftLog(client, title, fields = []) {
  await logToChannel(client, config.minecraftLogChannelId || config.modLogChannelId, title, fields);
}

export async function appealLog(client, title, fields = []) {
  await logToChannel(client, config.appealLogChannelId || config.modLogChannelId, title, fields);
}

export async function staffAuditLog(client, title, fields = []) {
  await logToChannel(client, config.staffAuditChannelId || config.modLogChannelId, title, fields);
}
