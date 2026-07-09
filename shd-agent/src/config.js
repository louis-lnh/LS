import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadDotEnv(path = join(process.cwd(), '.env')) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, '');
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function int(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

loadDotEnv();

export const config = {
  serverId: process.env.SERVER_ID || 'lifesteal-g17',
  apiUrl: (process.env.API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, ''),
  apiSharedSecret: process.env.API_SHARED_SECRET || '',
  heartbeatIntervalSeconds: int('HEARTBEAT_INTERVAL_SECONDS', 15),
  minecraft: {
    serviceName: process.env.MINECRAFT_SERVICE_NAME || 'lifesteal',
    processMatch: process.env.MINECRAFT_PROCESS_MATCH || 'fabric-server-launch.jar',
    logPath: process.env.MINECRAFT_LOG_PATH || '',
    crashDir: process.env.MINECRAFT_CRASH_DIR || '',
    queryHost: process.env.MINECRAFT_QUERY_HOST || '127.0.0.1',
    queryPort: int('MINECRAFT_QUERY_PORT', 25565)
  },
  backup: {
    dir: process.env.BACKUP_DIR || '',
    maxAgeHours: int('BACKUP_MAX_AGE_HOURS', 30)
  },
  rcon: {
    enabled: bool('RCON_PROBE_ENABLED', false),
    host: process.env.RCON_HOST || '127.0.0.1',
    port: int('RCON_PORT', 25575)
  }
};

export function assertConfig() {
  if (!config.apiSharedSecret) {
    throw new Error('API_SHARED_SECRET is required.');
  }
}
