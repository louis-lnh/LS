import { config } from '../src/config.js';
import { statements } from '../src/db.js';

const endpointBase = (process.env.LIFESTEAL_SMOKE_API_BASE_URL ?? `http://localhost:${config.port}`).replace(/\/$/, '');
const apiSecret = process.env.LIFESTEAL_SMOKE_API_SECRET ?? config.apiSharedSecret;

const fallbackPlayers = [
  {
    discordId: '100000000000000001',
    minecraftUuid: '11111111-1111-4111-8111-111111111111',
    minecraftName: 'HeartHunter',
    heartsCurrent: 20,
    killsTotal: 12,
    deathsTotal: 2,
    revivalsTotal: 0,
    heartGains: 10,
    heartLosses: 2,
    dragonEggHolder: true,
    maceWielder: true
  },
  {
    discordId: '100000000000000002',
    minecraftUuid: '22222222-2222-4222-8222-222222222222',
    minecraftName: 'LastPulse',
    heartsCurrent: 1,
    killsTotal: 4,
    deathsTotal: 7,
    revivalsTotal: 1,
    heartGains: 3,
    heartLosses: 12,
    dragonEggHolder: false,
    maceWielder: false
  },
  {
    discordId: '100000000000000003',
    minecraftUuid: '33333333-3333-4333-8333-333333333333',
    minecraftName: 'ReviveCraft',
    heartsCurrent: 8,
    killsTotal: 6,
    deathsTotal: 5,
    revivalsTotal: 2,
    heartGains: 5,
    heartLosses: 7,
    dragonEggHolder: false,
    maceWielder: false
  }
];

function isLocalEndpoint() {
  try {
    const host = new URL(endpointBase).hostname;
    return ['localhost', '127.0.0.1', '::1'].includes(host);
  } catch (_error) {
    return false;
  }
}

function existingPublicPlayers() {
  return statements.findLinkedAccounts.all()
    .filter((row) => row.status === 'active' && row.public_stats_opt_in)
    .map((row, index) => {
      const heartsCurrent = Math.max(1, Math.min(20, 20 - (index * 5)));
      return {
        discordId: row.discord_id,
        minecraftUuid: row.minecraft_uuid,
        minecraftName: row.minecraft_name ?? `Player${index + 1}`,
        heartsCurrent,
        killsTotal: 12 - index,
        deathsTotal: 2 + index,
        revivalsTotal: index === 0 ? 0 : 1,
        heartGains: Math.max(0, heartsCurrent - 10),
        heartLosses: Math.max(0, 10 - heartsCurrent),
        dragonEggHolder: index === 0,
        maceWielder: index === 0
      };
    });
}

function seedLinkedAccounts() {
  const now = Date.now();
  for (const player of fallbackPlayers) {
    statements.upsertLinked.run({
      discordId: player.discordId,
      minecraftUuid: player.minecraftUuid,
      minecraftName: player.minecraftName,
      discordUsername: `${player.minecraftName}#smoke`,
      ipHash: null,
      ipPrefixHash: null,
      verifiedAt: now,
      lastSeenAt: now,
      status: 'active',
      suspicious: 0,
      suspiciousReason: null,
      publicStatsOptIn: true
    });
  }
}

async function request(path, init) {
  const response = await fetch(`${endpointBase}${path}`, init);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (_error) {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}: ${text}`);
  }

  return body;
}

async function main() {
  if (!apiSecret) {
    throw new Error('API_SHARED_SECRET or LIFESTEAL_SMOKE_API_SECRET is required.');
  }

  if (!isLocalEndpoint() && process.env.LIFESTEAL_SMOKE_ALLOW_REMOTE !== 'true') {
    throw new Error('Refusing to write synthetic live data to a remote endpoint. Set LIFESTEAL_SMOKE_ALLOW_REMOTE=true to override.');
  }

  let players = existingPublicPlayers();
  if (players.length === 0) {
    seedLinkedAccounts();
    players = existingPublicPlayers();
  }

  const payload = {
    schemaVersion: 2,
    source: 'local-smoke',
    sentAt: new Date().toISOString(),
    status: {
      onlinePlayers: 3,
      maxPlayers: 100,
      grace: {
        active: false,
        paused: false,
        remainingSeconds: 0
      }
    },
    players: players.map((player) => ({
      minecraftUuid: player.minecraftUuid,
      playerId: player.minecraftUuid,
      heartsCurrent: player.heartsCurrent,
      hearts: player.heartsCurrent,
      killsTotal: player.killsTotal,
      kills: player.killsTotal,
      deathsTotal: player.deathsTotal,
      deaths: player.deathsTotal,
      revivalsTotal: player.revivalsTotal,
      revivals: player.revivalsTotal,
      heartGains: player.heartGains,
      heartLosses: player.heartLosses,
      maceKills: player.maceWielder ? 3 : null,
      eliminated: false,
      twentyHearts: player.heartsCurrent >= 20,
      dragonEggHolder: player.dragonEggHolder,
      maceWielder: player.maceWielder
    }))
  };

  const sync = await request('/api/v1/gameplay/roles/sync', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiSecret}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const health = await request('/api/v1/public/sync-health');
  const publicPlayers = await request('/api/v1/public/players');
  const objectives = await request('/api/v1/public/objectives');

  console.log(JSON.stringify({
    endpointBase,
    sync: {
      ok: sync.ok,
      roleSyncOk: sync.roleSyncOk,
      roleSyncError: sync.roleSyncError ?? null,
      publicPlayers: sync.publicPlayers,
      received: sync.received
    },
    health: health.health,
    players: publicPlayers.players.map((player) => ({
      rank: player.rank,
      name: player.name,
      hearts: player.hearts_current,
      kills: player.kills_total,
      prestige: player.prestige
    })),
    objectives: objectives.objectives
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
