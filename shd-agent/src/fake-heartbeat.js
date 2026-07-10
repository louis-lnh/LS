import os from 'node:os';
import { assertConfig, config } from './config.js';

assertConfig();

const payload = {
  serverId: config.serverId,
  hostname: os.hostname(),
  agentVersion: 'fake-0.1.0',
  sentAt: new Date().toISOString(),
  timestamp: new Date().toISOString(),
  host: {
    hostname: os.hostname(),
    uptimeSeconds: 86400,
    localIps: ['127.0.0.1'],
    networkOnline: true
  },
  system: {
    cpuPercent: 24,
    load1: 0.82,
    load5: 0.74,
    load15: 0.66,
    ramUsedGb: 9.8,
    ramTotalGb: 31.1,
    ramFreeGb: 21.3,
    ramPercent: 31.5,
    diskPath: '/opt/shd',
    diskUsedGb: 218,
    diskTotalGb: 930,
    diskFreeGb: 712,
    diskPercent: 23.4,
    tempC: 67,
    uptimeSeconds: 86400
  },
  minecraft: {
    serviceName: 'lifesteal',
    serviceState: 'active',
    serviceActive: true,
    processRunning: true,
    logFresh: true,
    online: true,
    queryOnline: true,
    playersOnline: 0,
    maxPlayers: 35,
    versionName: '1.21.11',
    pingError: null,
    rconAvailable: null,
    rconError: null,
    latestWarning: null,
    latestError: null,
    cantKeepUpCount: 0,
    errorCount: 0,
    crashDetected: false,
    serverStarted: true,
    serverStopping: false,
    joinCount: 0,
    leaveCount: 0,
    chunky: {
      active: false,
      progressPercent: null,
      latestLine: null,
      completed: false
    }
  },
  logs: {
    latestWarning: null,
    latestError: null,
    cantKeepUpCountLast10Min: 0,
    errorCountLast10Min: 0,
    crashDetected: false,
    lastCrashReport: null,
    serverStarted: true,
    serverStopping: false,
    joinCount: 0,
    leaveCount: 0,
    chunky: {
      active: false,
      progressPercent: null,
      latestLine: null,
      completed: false
    }
  },
  backup: {
    lastBackupAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    ageSeconds: 3 * 60 * 60,
    ageHours: 3,
    count: 4,
    sizeGb: 12.5,
    stale: false
  },
  agent: {
    version: 'fake-0.1.0',
    mode: 'monitoring',
    actionsEnabled: false
  },
  issues: []
};

const response = await fetch(`${config.apiUrl}/api/v1/server/heartbeat`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${config.apiSharedSecret}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

console.log(response.status, await response.text());
