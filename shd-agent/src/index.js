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

function percent(used, total) {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((used / total) * 1000) / 10;
}

async function diskUsage(path = config.diskPath) {
  const output = await run('df', ['-k', path]);
  if (!output) return { diskUsedGb: null, diskTotalGb: null };
  const lines = output.split(/\r?\n/);
  const parts = lines.at(-1)?.trim().split(/\s+/) ?? [];
  const totalKb = Number(parts[1]);
  const usedKb = Number(parts[2]);
  if (!Number.isFinite(totalKb) || !Number.isFinite(usedKb)) return { diskUsedGb: null, diskTotalGb: null };
  const diskUsedGb = gb(usedKb * 1024);
  const diskTotalGb = gb(totalKb * 1024);
  return {
    diskPath: path,
    diskUsedGb,
    diskTotalGb,
    diskFreeGb: gb((totalKb - usedKb) * 1024),
    diskPercent: percent(diskUsedGb, diskTotalGb)
  };
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
  const ramUsedGb = gb(total - free);
  const ramTotalGb = gb(total);
  const [load1, load5, load15] = os.loadavg().map((value) => Math.round(value * 100) / 100);
  return {
    cpuPercent: await cpuPercent(),
    load1,
    load5,
    load15,
    ramUsedGb,
    ramTotalGb,
    ramFreeGb: gb(free),
    ramPercent: percent(ramUsedGb, ramTotalGb),
    ...(await diskUsage()),
    tempC: await temperatureC(),
    uptimeSeconds: Math.floor(os.uptime())
  };
}

async function serviceState() {
  const result = await run('systemctl', ['is-active', config.minecraft.serviceName]);
  return result || null;
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
  const relevant = text.split(/\r?\n/).filter((line) => /warn|error|exception|can't keep up|crash/i.test(line));
  const warnings = relevant.filter((line) => /warn|can't keep up/i.test(line)).slice(-8);
  const errors = relevant.filter((line) => /error|exception|crash/i.test(line)).slice(-8);
  const crash = crashDetected();
  const lines = text.split(/\r?\n/);
  const chunkyLines = lines.filter((line) => /chunky/i.test(line));
  const latestChunky = chunkyLines.at(-1) ?? null;
  const chunkyProgress = latestChunky?.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? null;
  return {
    logFresh,
    latestWarning: warnings.at(-1)?.slice(0, 500) ?? null,
    latestError: errors.at(-1)?.slice(0, 500) ?? null,
    cantKeepUpCount: relevant.filter((line) => /can't keep up/i.test(line)).length,
    errorCount: errors.length,
    crashDetected: crash,
    lastCrashReport: crash ? latestCrashReport() : null,
    serverStarted: /Done \(/i.test(text),
    serverStopping: /Stopping server/i.test(text),
    joinCount: lines.filter((line) => /joined the game/i.test(line)).length,
    leaveCount: lines.filter((line) => /left the game/i.test(line)).length,
    chunky: {
      active: chunkyLines.some((line) => /chunky/i.test(line) && !/complete|finished/i.test(line)),
      progressPercent: chunkyProgress == null ? null : Number(chunkyProgress),
      latestLine: latestChunky?.slice(0, 500) ?? null,
      completed: chunkyLines.some((line) => /complete|finished/i.test(line))
    }
  };
}

function crashDetected() {
  if (!config.minecraft.crashDir || !existsSync(config.minecraft.crashDir)) return false;
  return readdirSync(config.minecraft.crashDir)
    .some((name) => Date.now() - statSync(join(config.minecraft.crashDir, name)).mtimeMs < 10 * 60_000);
}

function latestCrashReport() {
  if (!config.minecraft.crashDir || !existsSync(config.minecraft.crashDir)) return null;
  return readdirSync(config.minecraft.crashDir)
    .map((name) => {
      const path = join(config.minecraft.crashDir, name);
      const stats = statSync(path);
      return stats.isFile() ? { name, mtimeMs: stats.mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.name ?? null;
}

function writeVarInt(value) {
  const bytes = [];
  let current = value >>> 0;
  if (value < 0) current = 0xffffffff + value + 1;
  do {
    let temp = current & 0x7f;
    current >>>= 7;
    if (current !== 0) temp |= 0x80;
    bytes.push(temp);
  } while (current !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buffer, offset = 0) {
  let value = 0;
  let position = 0;
  let currentOffset = offset;
  while (currentOffset < buffer.length) {
    const current = buffer[currentOffset];
    value |= (current & 0x7f) << (7 * position);
    currentOffset += 1;
    if ((current & 0x80) === 0) return { value, offset: currentOffset };
    position += 1;
    if (position > 5) throw new Error('VarInt is too large');
  }
  return null;
}

function packet(payload) {
  return Buffer.concat([writeVarInt(payload.length), payload]);
}

function stringField(value) {
  const data = Buffer.from(value, 'utf8');
  return Buffer.concat([writeVarInt(data.length), data]);
}

function parseStatusResponse(buffer) {
  const packetLength = readVarInt(buffer, 0);
  if (!packetLength) return null;
  const packetId = readVarInt(buffer, packetLength.offset);
  if (!packetId || packetId.value !== 0) return null;
  const jsonLength = readVarInt(buffer, packetId.offset);
  if (!jsonLength) return null;
  const end = jsonLength.offset + jsonLength.value;
  if (buffer.length < end) return null;
  return JSON.parse(buffer.slice(jsonLength.offset, end).toString('utf8'));
}

async function minecraftStatus() {
  if (!config.minecraft.queryEnabled) {
    return { online: null, playersOnline: null, maxPlayers: null, versionName: null, pingError: null };
  }

  return new Promise((resolve) => {
    const chunks = [];
    const socket = net.createConnection({ host: config.minecraft.queryHost, port: config.minecraft.queryPort, timeout: 1500 });
    const finish = (status) => {
      socket.destroy();
      resolve(status);
    };
    socket.once('connect', () => {
      const host = config.minecraft.queryHost;
      const handshakePayload = Buffer.concat([
        writeVarInt(0),
        writeVarInt(0),
        stringField(host),
        Buffer.from([(config.minecraft.queryPort >> 8) & 0xff, config.minecraft.queryPort & 0xff]),
        writeVarInt(1)
      ]);
      socket.write(packet(handshakePayload));
      socket.write(packet(Buffer.from([0])));
    });
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      try {
        const response = parseStatusResponse(Buffer.concat(chunks));
        if (!response) return;
        finish({
          online: true,
          playersOnline: Number.isFinite(response.players?.online) ? response.players.online : null,
          maxPlayers: Number.isFinite(response.players?.max) ? response.players.max : null,
          versionName: response.version?.name ?? null,
          pingError: null
        });
      } catch (error) {
        finish({ online: false, playersOnline: null, maxPlayers: null, versionName: null, pingError: error.message });
      }
    });
    socket.once('timeout', () => finish({ online: false, playersOnline: null, maxPlayers: null, versionName: null, pingError: 'Minecraft status ping timed out' }));
    socket.once('error', (error) => finish({ online: false, playersOnline: null, maxPlayers: null, versionName: null, pingError: error.message }));
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
    return { lastBackupAt: null, ageSeconds: null, ageHours: null, count: null, sizeGb: null, stale: null };
  }
  const files = listFiles(config.backup.dir).sort((a, b) => b.mtimeMs - a.mtimeMs);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const latest = files[0] ?? null;
  const ageSeconds = latest ? Math.floor((Date.now() - latest.mtimeMs) / 1000) : null;
  return {
    lastBackupAt: latest ? new Date(latest.mtimeMs).toISOString() : null,
    ageSeconds,
    ageHours: ageSeconds == null ? null : Math.round((ageSeconds / 3600) * 10) / 10,
    count: files.length,
    sizeGb: gb(totalSize),
    stale: ageSeconds == null ? null : ageSeconds > config.backup.maxAgeHours * 3600
  };
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    const stats = statSync(path);
    if (entry.isDirectory()) return listFiles(path);
    return entry.isFile() ? [{ path, mtimeMs: stats.mtimeMs, size: stats.size }] : [];
  });
}

function localIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && !item.internal && item.family === 'IPv4')
    .map((item) => item.address);
}

async function collectHeartbeat() {
  const [system, state, running, status, rcon] = await Promise.all([
    systemMetrics(),
    serviceState(),
    processRunning(),
    minecraftStatus(),
    rconProbe()
  ]);
  const log = logInfo();
  const minecraft = {
    serviceName: config.minecraft.serviceName,
    serviceState: state,
    serviceActive: state == null ? null : state === 'active',
    processRunning: running,
    online: status.online,
    queryOnline: status.online,
    playersOnline: status.playersOnline,
    maxPlayers: status.maxPlayers,
    versionName: status.versionName,
    pingError: status.pingError,
    ...log,
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
    timestamp: new Date().toISOString(),
    host: {
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
      localIps: localIps(),
      networkOnline: localIps().length > 0
    },
    system,
    minecraft,
    logs: {
      latestWarning: log.latestWarning,
      latestError: log.latestError,
      cantKeepUpCountLast10Min: log.cantKeepUpCount,
      errorCountLast10Min: log.errorCount,
      crashDetected: log.crashDetected,
      lastCrashReport: log.lastCrashReport,
      serverStarted: log.serverStarted,
      serverStopping: log.serverStopping,
      joinCount: log.joinCount,
      leaveCount: log.leaveCount,
      chunky: log.chunky
    },
    backup,
    agent: {
      version: agentVersion,
      mode: config.actionsEnabled ? 'actions-enabled' : 'monitoring',
      actionsEnabled: config.actionsEnabled
    },
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

async function fetchPendingActions() {
  const url = new URL(`${config.apiUrl}/api/v1/server/actions/pending`);
  url.searchParams.set('serverId', config.serverId);
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${config.apiSharedSecret}`,
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`Action poll failed with HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

async function reportActionResult(result) {
  const response = await fetch(`${config.apiUrl}/api/v1/server/actions/${encodeURIComponent(result.actionId)}/result`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiSharedSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(result)
  });
  if (!response.ok) throw new Error(`Action result failed with HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

async function executeAction(action) {
  const startedAt = new Date().toISOString();
  return {
    actionId: action.id,
    serverId: config.serverId,
    type: action.type ?? 'UNKNOWN',
    status: 'skipped',
    startedAt,
    finishedAt: new Date().toISOString(),
    message: 'Remote action execution is intentionally disabled in this monitoring MVP.',
    details: {
      configuredActionsEnabled: config.actionsEnabled,
      requestedType: action.type ?? null
    }
  };
}

async function pollActions() {
  if (!config.actionsEnabled) return;
  const payload = await fetchPendingActions();
  if (!payload.actionsEnabled || !Array.isArray(payload.actions) || payload.actions.length === 0) return;
  for (const action of payload.actions) {
    const result = await executeAction(action);
    await reportActionResult(result);
    console.log(`[${new Date().toISOString()}] action ${result.type} ${result.status}: ${result.message}`);
  }
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

if (config.actionsEnabled) {
  await pollActions().catch((error) => console.error(`[${new Date().toISOString()}] ${error.message}`));
  setInterval(() => {
    pollActions().catch((error) => console.error(`[${new Date().toISOString()}] ${error.message}`));
  }, Math.max(10, config.actionPollIntervalSeconds) * 1000);
}
