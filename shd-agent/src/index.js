import { execFile } from 'node:child_process';
import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { assertConfig, config } from './config.js';

const execFileAsync = promisify(execFile);
const agentVersion = '0.1.0';

function gb(bytes) {
  return Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10;
}

async function run(command, args, timeout = 2500) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function cpuPercent() {
  const first = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const second = os.cpus();
  let idle = 0;
  let total = 0;
  for (let index = 0; index < first.length; index += 1) {
    const a = first[index].times;
    const b = second[index].times;
    const idleDelta = b.idle - a.idle;
    const totalDelta = Object.keys(b).reduce((sum, key) => sum + (b[key] - a[key]), 0);
    idle += idleDelta;
    total += totalDelta;
  }
  if (total <= 0) return null;
  return Math.round((100 - (idle / total) * 100) * 10) / 10;
}

async function diskUsage() {
  const output = await run('df', ['-k', '/']);
  if (!output) return { diskUsedGb: null, diskTotalGb: null };
  const lines = output.split(/\r?\n/);
  const parts = lines.at(-1)?.trim().split(/\s+/) ?? [];
  const totalKb = Number(parts[1]);
  const usedKb = Number(parts[2]);
  if (!Number.isFinite(totalKb) || !Number.isFinite(usedKb)) return { diskUsedGb: null, diskTotalGb: null };
  return { diskUsedGb: gb(usedKb * 1024), diskTotalGb: gb(totalKb * 1024) };
}

async function temperatureC() {
  const thermal = await run('bash', ['-lc', 'for f in /sys/class/thermal/thermal_zone*/temp; do [ -r "$f" ] && cat "$f" && exit 0; done']);
  const raw = Number(thermal);
  if (Number.isFinite(raw) && raw > 0) return Math.round((raw / 1000) * 10) / 10;
  const sensors = await run('sensors', []);
  const match = sensors?.match(/(?:Package id 0|Tctl|CPU):\s+\+?([0-9.]+)C/i);
  return match ? Number(match[1]) : null;
}

async function systemMetrics() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    cpuPercent: await cpuPercent(),
    ramUsedGb: gb(total - free),
    ramTotalGb: gb(total),
    ...(await diskUsage()),
    tempC: await temperatureC(),
    uptimeSeconds: Math.floor(os.uptime())
  };
}

async function serviceActive() {
  const result = await run('systemctl', ['is-active', config.minecraft.serviceName]);
  if (!result) return null;
  return result === 'active';
}

async function processRunning() {
  const result = await run('pgrep', ['-f', config.minecraft.processMatch]);
  return result == null ? null : result.length > 0;
}

function readTail(path, maxBytes = 128 * 1024) {
  if (!path || !existsSync(path)) return '';
  const stats = statSync(path);
  const length = Math.min(stats.size, maxBytes);
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buffer, 0, length, Math.max(0, stats.size - length));
    return buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

function logInfo() {
  const text = readTail(config.minecraft.logPath);
  const logFresh = config.minecraft.logPath && existsSync(config.minecraft.logPath)
    ? Date.now() - statSync(config.minecraft.logPath).mtimeMs < 2 * 60_000
    : null;
  const warnings = text
    .split(/\r?\n/)
    .filter((line) => /warn|error|exception|can't keep up|crash/i.test(line))
    .slice(-8);
  return {
    logFresh,
    latestWarning: warnings.at(-1)?.slice(0, 500) ?? null,
    cantKeepUpCount: warnings.filter((line) => /can't keep up/i.test(line)).length,
    crashDetected: crashDetected()
  };
}

function crashDetected() {
  if (!config.minecraft.crashDir || !existsSync(config.minecraft.crashDir)) return false;
  return readdirSync(config.minecraft.crashDir)
    .some((name) => Date.now() - statSync(join(config.minecraft.crashDir, name)).mtimeMs < 10 * 60_000);
}

async function minecraftPing() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: config.minecraft.queryHost, port: config.minecraft.queryPort, timeout: 1500 });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function rconProbe() {
  if (!config.rcon.enabled) return { rconAvailable: null, rconError: null };
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: config.rcon.host, port: config.rcon.port, timeout: 1500 });
    socket.once('connect', () => {
      socket.end();
      resolve({ rconAvailable: true, rconError: null });
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve({ rconAvailable: false, rconError: 'RCON TCP probe timed out' });
    });
    socket.once('error', (error) => resolve({ rconAvailable: false, rconError: error.message }));
  });
}

function backupInfo() {
  if (!config.backup.dir || !existsSync(config.backup.dir)) {
    return { lastBackupAt: null, ageSeconds: null, count: null, sizeGb: null };
  }
  const files = readdirSync(config.backup.dir)
    .map((name) => {
      const path = join(config.backup.dir, name);
      const stats = statSync(path);
      return stats.isFile() ? { path, mtimeMs: stats.mtimeMs, size: stats.size } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const latest = files[0] ?? null;
  return {
    lastBackupAt: latest ? new Date(latest.mtimeMs).toISOString() : null,
    ageSeconds: latest ? Math.floor((Date.now() - latest.mtimeMs) / 1000) : null,
    count: files.length,
    sizeGb: gb(totalSize)
  };
}

async function collectHeartbeat() {
  const [system, active, running, online, rcon] = await Promise.all([
    systemMetrics(),
    serviceActive(),
    processRunning(),
    minecraftPing(),
    rconProbe()
  ]);
  const minecraft = {
    serviceActive: active,
    processRunning: running,
    online,
    playersOnline: null,
    maxPlayers: null,
    ...logInfo(),
    ...rcon
  };
  const backup = backupInfo();
  const issues = [];
  if (minecraft.serviceActive === false) issues.push('minecraft_service_inactive');
  if (minecraft.processRunning === false) issues.push('minecraft_process_missing');
  if (minecraft.online === false) issues.push('minecraft_port_unreachable');
  if (minecraft.crashDetected) issues.push('minecraft_crash_detected');
  if (backup.ageSeconds != null && backup.ageSeconds > config.backup.maxAgeHours * 3600) issues.push('backup_stale');

  return {
    serverId: config.serverId,
    hostname: os.hostname(),
    agentVersion,
    sentAt: new Date().toISOString(),
    system,
    minecraft,
    backup,
    issues
  };
}

async function sendHeartbeat(payload) {
  const response = await fetch(`${config.apiUrl}/api/v1/server/heartbeat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiSharedSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Heartbeat failed with HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

async function tick() {
  const payload = await collectHeartbeat();
  const result = await sendHeartbeat(payload);
  console.log(`[${new Date().toISOString()}] heartbeat ${result.health} ${result.ageSeconds ?? 0}s`);
}

assertConfig();
await tick().catch((error) => console.error(error.message));
setInterval(() => {
  tick().catch((error) => console.error(`[${new Date().toISOString()}] ${error.message}`));
}, Math.max(5, config.heartbeatIntervalSeconds) * 1000);
