import os from 'node:os';
import { assertConfig, config } from './config.js';

assertConfig();

const payload = {
  serverId: config.serverId,
  hostname: os.hostname(),
  agentVersion: 'fake-0.1.0',
  sentAt: new Date().toISOString(),
  system: {
    cpuPercent: 24,
    ramUsedGb: 9.8,
    ramTotalGb: 31.1,
    diskUsedGb: 218,
    diskTotalGb: 930,
    tempC: 67,
    uptimeSeconds: 86400
  },
  minecraft: {
    serviceActive: true,
    processRunning: true,
    logFresh: true,
    online: true,
    playersOnline: 0,
    maxPlayers: 35,
    rconAvailable: null,
    rconError: null,
    latestWarning: null,
    cantKeepUpCount: 0,
    crashDetected: false
  },
  backup: {
    lastBackupAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    ageSeconds: 3 * 60 * 60,
    count: 4,
    sizeGb: 12.5
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
