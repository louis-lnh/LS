import { Rcon } from 'rcon-client';
import { config } from './config.js';

export async function resolveMinecraftProfile(username) {
  const safeUsername = username.trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(safeUsername)) {
    throw new Error('Minecraft usernames must be 3-16 characters using letters, numbers, or underscores.');
  }

  const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(safeUsername)}`);
  if (response.status === 204 || response.status === 404) {
    throw new Error(`No Minecraft account named ${safeUsername} was found.`);
  }
  if (!response.ok) {
    throw new Error(`Mojang lookup failed with HTTP ${response.status}.`);
  }

  const profile = await response.json();
  const id = profile.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  return { uuid: id, name: profile.name };
}

async function withRcon(fn) {
  if (!config.rcon.enabled) return null;
  if (!config.rcon.password) throw new Error('RCON is enabled but MINECRAFT_RCON_PASSWORD is empty.');

  const rcon = await Rcon.connect({
    host: config.rcon.host,
    port: config.rcon.port,
    password: config.rcon.password
  });

  try {
    return await fn(rcon);
  } finally {
    await rcon.end();
  }
}

export async function whitelistAdd(username) {
  return withRcon((rcon) => rcon.send(`whitelist add ${username}`));
}

export async function whitelistRemove(username) {
  return withRcon((rcon) => rcon.send(`whitelist remove ${username}`));
}

export async function minecraftBan(username, reason) {
  const cleanReason = reason?.replace(/[\r\n]/g, ' ').slice(0, 180) || 'Banned by Discord moderation';
  return withRcon((rcon) => rcon.send(`ban ${username} ${cleanReason}`));
}

export async function minecraftTempBan(username, duration, reason) {
  const cleanDuration = String(duration ?? '').trim();
  if (!/^\d+[smhdw]$/.test(cleanDuration)) {
    throw new Error('Temporary ban duration must look like 30m, 12h, 7d, or 1w.');
  }
  const cleanReason = reason?.replace(/[\r\n]/g, ' ').slice(0, 180) || 'Temporarily suspended by Discord moderation';
  return withRcon((rcon) => rcon.send(`tempban ${username} ${cleanDuration} ${cleanReason}`));
}

export async function minecraftUnban(username) {
  return withRcon((rcon) => rcon.send(`pardon ${username}`));
}

export async function minecraftKick(username, reason) {
  const cleanReason = reason?.replace(/[\r\n]/g, ' ').slice(0, 180) || 'Kicked by Discord moderation';
  return withRcon((rcon) => rcon.send(`kick ${username} ${cleanReason}`));
}
