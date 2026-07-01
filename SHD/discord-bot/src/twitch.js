import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { config } from './config.js';
import { statements } from './db.js';
import { audit, systemLog } from './logger.js';

let appToken = null;
let appTokenExpiresAt = 0;
let monitorStarted = false;

export function twitchConfigured() {
  return Boolean(
    config.twitch.clientId &&
    config.twitch.clientSecret &&
    config.channels.twitchLive &&
    config.twitch.usernames.length > 0
  );
}

export function startTwitchLiveMonitor(client) {
  if (monitorStarted) return;
  monitorStarted = true;

  if (!twitchConfigured()) {
    console.log('Twitch live monitor disabled: missing Twitch app config, live channel, or watched usernames.');
    return;
  }

  const intervalMs = Math.max(config.twitch.pollIntervalMs, 60_000);
  const run = async () => {
    await checkTwitchLive(client).catch((error) => {
      console.error('Twitch live monitor failed:', error);
      audit('twitch.monitor_error', {
        data: { error: error.message }
      });
    });
  };

  setTimeout(run, 10_000);
  setInterval(run, intervalMs);
  console.log(`Twitch live monitor watching ${config.twitch.usernames.join(', ')} every ${Math.round(intervalMs / 1000)}s.`);
}

export async function checkTwitchLive(client) {
  if (!twitchConfigured()) return { ok: false, reason: 'not_configured' };

  const streams = await fetchLiveStreams();
  const liveByLogin = new Map(streams.map((stream) => [stream.user_login.toLowerCase(), stream]));
  const now = Date.now();
  let announced = 0;

  for (const login of config.twitch.usernames) {
    const stream = liveByLogin.get(login);
    const previous = statements.twitchLiveStates.get(login);

    if (!stream) {
      statements.twitchLiveStates.upsert({
        login,
        display_name: previous?.display_name ?? login,
        is_live: false,
        stream_id: null,
        notified_stream_id: previous?.notified_stream_id ?? null,
        title: previous?.title ?? null,
        game_name: previous?.game_name ?? null,
        started_at: previous?.started_at ?? null,
        last_seen_at: now
      });
      continue;
    }

    const alreadyNotified = previous?.notified_stream_id === stream.id;
    if (!alreadyNotified) {
      await postLiveNotification(client, stream);
      announced += 1;
    }

    statements.twitchLiveStates.upsert({
      login,
      display_name: stream.user_name,
      is_live: true,
      stream_id: stream.id,
      notified_stream_id: stream.id,
      title: stream.title,
      game_name: stream.game_name,
      started_at: stream.started_at,
      last_seen_at: now
    });
  }

  return { ok: true, watched: config.twitch.usernames.length, live: streams.length, announced };
}

async function fetchLiveStreams() {
  const token = await getAppToken();
  const params = new URLSearchParams();
  for (const username of config.twitch.usernames.slice(0, 100)) {
    params.append('user_login', username);
  }

  const response = await fetch(`https://api.twitch.tv/helix/streams?${params.toString()}`, {
    headers: {
      'Client-ID': config.twitch.clientId,
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Twitch streams request failed with ${response.status}.`);
  }
  return data.data ?? [];
}

async function getAppToken() {
  if (appToken && Date.now() < appTokenExpiresAt - 60_000) {
    return appToken;
  }

  const body = new URLSearchParams({
    client_id: config.twitch.clientId,
    client_secret: config.twitch.clientSecret,
    grant_type: 'client_credentials'
  });
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || `Twitch token request failed with ${response.status}.`);
  }

  appToken = data.access_token;
  appTokenExpiresAt = Date.now() + Number(data.expires_in ?? 3600) * 1000;
  return appToken;
}

async function postLiveNotification(client, stream) {
  const channel = await client.channels.fetch(config.channels.twitchLive).catch((error) => {
    throw new Error(`Could not fetch Twitch live channel: ${error.message}`);
  });
  if (!channel?.isTextBased()) {
    throw new Error('Configured TWITCH_LIVE_CHANNEL_ID is not a text channel.');
  }

  const url = `https://www.twitch.tv/${stream.user_login}`;
  const thumbnail = String(stream.thumbnail_url ?? '')
    .replace('{width}', '1280')
    .replace('{height}', '720');
  const embed = new EmbedBuilder()
    .setColor(0x9146ff)
    .setAuthor({ name: `${stream.user_name} is live on Twitch` })
    .setTitle(stream.title || 'Live now')
    .setURL(url)
    .setDescription(stream.game_name ? `Streaming **${stream.game_name}**` : 'Streaming now')
    .addFields(
      { name: 'Viewers', value: String(stream.viewer_count ?? 0), inline: true },
      { name: 'Started', value: stream.started_at ? `<t:${Math.floor(new Date(stream.started_at).getTime() / 1000)}:R>` : 'now', inline: true }
    )
    .setTimestamp(new Date());

  if (thumbnail) {
    embed.setImage(`${thumbnail}?shd=${encodeURIComponent(stream.id)}`);
  }

  const content = config.roles.live ? `<@&${config.roles.live}>` : undefined;
  await channel.send({
    content,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Watch on Twitch')
        .setStyle(ButtonStyle.Link)
        .setURL(url)
    )],
    allowedMentions: config.roles.live ? { roles: [config.roles.live] } : { parse: [] }
  });

  audit('twitch.live_announced', {
    targetId: stream.user_login,
    data: {
      streamId: stream.id,
      title: stream.title,
      gameName: stream.game_name,
      channelId: config.channels.twitchLive
    }
  });
  await systemLog(client, 'Twitch live notification sent', [
    { name: 'Streamer', value: stream.user_name, inline: true },
    { name: 'Channel', value: `<#${config.channels.twitchLive}>`, inline: true },
    { name: 'Stream', value: url }
  ]);
}
