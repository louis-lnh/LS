import express from 'express';
import { z } from 'zod';
import { config } from './config.js';
import { statements } from './db.js';
import { clientIp, ipHashes } from './privacy.js';
import { completeMinecraftLink, completeVerification } from './verification.js';
import { audit, minecraftLog, securityLog } from './logger.js';
import { refreshRisk } from './risk.js';
import { currentRulesVersion } from './settings.js';

const minecraftJoinSchema = z.object({
  minecraftUuid: z.string().min(32).max(36),
  minecraftName: z.string().min(3).max(16),
  ip: z.string().min(3).optional()
});

const minecraftLinkSchema = z.object({
  code: z.string().min(4).max(32),
  minecraftUuid: z.string().min(32).max(36),
  minecraftName: z.string().min(3).max(16),
  ip: z.string().min(3).optional()
});

const gameplayRoleSnapshotSchema = z.object({
  minecraftUuid: z.string().min(32).max(36).optional(),
  playerId: z.string().min(32).max(36).optional(),
  hearts: z.number().int().min(1).max(20).optional(),
  eliminated: z.boolean().default(false),
  twentyHearts: z.boolean().default(false),
  dragonEggHolder: z.boolean().default(false),
  maceWielder: z.boolean().default(false)
}).refine((value) => value.minecraftUuid || value.playerId, {
  message: 'minecraftUuid or playerId is required'
});

const gameplayRoleSyncSchema = z.object({
  players: z.array(gameplayRoleSnapshotSchema).max(500)
});

const minecraftEventSchema = z.object({
  type: z.string().min(3).max(80),
  minecraftUuid: z.string().min(32).max(36).optional(),
  minecraftName: z.string().min(1).max(32).optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  message: z.string().min(1).max(1000),
  data: z.record(z.unknown()).optional()
});

const gameplayRoleMappings = [
  ['twentyHearts', 'twentyHearts'],
  ['dragonEggHolder', 'dragonEgg'],
  ['maceWielder', 'mace'],
  ['eliminated', 'eliminated']
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #101418; color: #f7faf8; }
    main { max-width: 620px; margin: 12vh auto; padding: 32px; }
    h1 { font-size: 28px; margin: 0 0 12px; }
    p { line-height: 1.55; color: #cbd5d1; }
    button, a.button { display: inline-block; border: 0; border-radius: 6px; padding: 12px 16px; background: #35b87f; color: #07100c; font-weight: 700; text-decoration: none; cursor: pointer; }
    .muted { color: #96a39d; font-size: 14px; }
    .warn { color: #ffd27a; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function requireApiSecret(req, res, next) {
  if (!config.apiSharedSecret) return res.status(503).json({ error: 'API_SHARED_SECRET is not configured' });
  const header = req.headers.authorization ?? '';
  if (header !== `Bearer ${config.apiSharedSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireOverlayToken(req, res, next) {
  if (!config.overlay.publicToken) return next();
  const header = req.headers.authorization ?? '';
  const queryToken = req.query.token ?? '';
  if (header === `Bearer ${config.overlay.publicToken}` || queryToken === config.overlay.publicToken) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function minecraftUuidVariants(value) {
  const clean = String(value).toLowerCase();
  const compact = clean.replaceAll('-', '');
  return [...new Set([clean, compact])];
}

function findLinkedMinecraftAccount(minecraftUuid) {
  for (const uuid of minecraftUuidVariants(minecraftUuid)) {
    const linked = statements.findLinkedByMinecraft.get(uuid);
    if (linked) return linked;
  }
  return null;
}

function sameMinecraftUuid(left, right) {
  if (!left || !right) return false;
  const wanted = new Set(minecraftUuidVariants(left));
  return minecraftUuidVariants(right).some((uuid) => wanted.has(uuid));
}

function saveOverlayLifestealPlayer(snapshots) {
  if (!config.overlay.lifestealPlayerUuid) {
    return { configured: false, saved: false };
  }

  const snapshot = snapshots.find((item) =>
    sameMinecraftUuid(config.overlay.lifestealPlayerUuid, item.minecraftUuid ?? item.playerId)
  );
  if (!snapshot) {
    return { configured: true, saved: false };
  }

  const minecraftUuid = snapshot.minecraftUuid ?? snapshot.playerId;
  const linked = findLinkedMinecraftAccount(minecraftUuid);
  statements.upsertOverlayLifestealPlayer.run({
    minecraftUuid,
    minecraftName: linked?.minecraft_name ?? null,
    hearts: snapshot.hearts ?? null,
    eliminated: snapshot.eliminated,
    twentyHearts: snapshot.twentyHearts,
    dragonEggHolder: snapshot.dragonEggHolder,
    maceWielder: snapshot.maceWielder,
    updatedAt: Date.now()
  });
  return { configured: true, saved: true };
}

async function syncGameplayRoles(client, snapshots) {
  const configuredRoles = gameplayRoleMappings
    .map(([snapshotKey, configKey]) => ({
      snapshotKey,
      configKey,
      roleId: config.gameplayRoleIds[configKey]
    }))
    .filter((role) => role.roleId);
  const configuredHeartRoles = Object.entries(config.gameplayRoleIds.hearts)
    .map(([hearts, roleId]) => ({ hearts: Number(hearts), roleId }))
    .filter((role) => role.roleId);
  const allManagedRoleIds = [
    ...configuredRoles.map((role) => role.roleId),
    ...configuredHeartRoles.map((role) => role.roleId)
  ];

  if (configuredRoles.length === 0 && configuredHeartRoles.length === 0) {
    return {
      configuredRoles: 0,
      received: snapshots.length,
      linked: 0,
      members: 0,
      added: 0,
      removed: 0,
      clearedMissing: 0,
      skipped: snapshots.length,
      errors: 0
    };
  }

  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) {
    throw new Error('Configured Discord guild was not found.');
  }

  const stats = {
    configuredRoles: configuredRoles.length + configuredHeartRoles.length,
    received: snapshots.length,
    linked: 0,
    members: 0,
    added: 0,
    removed: 0,
    clearedMissing: 0,
    skipped: 0,
    errors: 0
  };
  const syncedDiscordIds = new Set();

  for (const snapshot of snapshots) {
    const minecraftUuid = snapshot.minecraftUuid ?? snapshot.playerId;
    const linked = findLinkedMinecraftAccount(minecraftUuid);
    if (!linked || linked.status !== 'active') {
      stats.skipped += 1;
      continue;
    }
    stats.linked += 1;
    syncedDiscordIds.add(linked.discord_id);

    const member = await guild.members.fetch(linked.discord_id).catch(() => null);
    if (!member) {
      stats.skipped += 1;
      continue;
    }
    stats.members += 1;

    for (const role of configuredRoles) {
      const shouldHaveRole = Boolean(snapshot[role.snapshotKey]);
      const hasRole = member.roles.cache.has(role.roleId);
      try {
        if (shouldHaveRole && !hasRole) {
          await member.roles.add(role.roleId, `Lifesteal gameplay role: ${role.configKey}`);
          stats.added += 1;
        } else if (!shouldHaveRole && hasRole) {
          await member.roles.remove(role.roleId, `Lifesteal gameplay role: ${role.configKey}`);
          stats.removed += 1;
        }
      } catch (_error) {
        stats.errors += 1;
      }
    }

    if (snapshot.hearts != null) {
      for (const role of configuredHeartRoles) {
        const shouldHaveRole = Number(snapshot.hearts) === role.hearts;
        const hasRole = member.roles.cache.has(role.roleId);
        try {
          if (shouldHaveRole && !hasRole) {
            await member.roles.add(role.roleId, `Lifesteal heart role: ${role.hearts}`);
            stats.added += 1;
          } else if (!shouldHaveRole && hasRole) {
            await member.roles.remove(role.roleId, `Lifesteal heart role: ${role.hearts}`);
            stats.removed += 1;
          }
        } catch (_error) {
          stats.errors += 1;
        }
      }
    }
  }

  for (const linked of statements.findLinkedAccounts.all()) {
    if (linked.status !== 'active' || syncedDiscordIds.has(linked.discord_id)) {
      continue;
    }

    const member = await guild.members.fetch(linked.discord_id).catch(() => null);
    if (!member) {
      continue;
    }

    for (const roleId of allManagedRoleIds) {
      if (!member.roles.cache.has(roleId)) {
        continue;
      }

      try {
        await member.roles.remove(roleId, 'Lifesteal gameplay role no longer present in full sync');
        stats.removed += 1;
        stats.clearedMissing += 1;
      } catch (_error) {
        stats.errors += 1;
      }
    }
  }

  return stats;
}

export function startWebServer(client) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.set('trust proxy', true);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/verify/:token', (req, res) => {
    const token = req.params.token;
    const row = statements.getToken.get(token);
    if (!row || row.used_at || Date.now() > row.expires_at) {
      return res.status(400).send(page('Verification unavailable', `
        <h1>Verification unavailable</h1>
        <p>This link is missing, expired, or already used. Return to Discord and run <strong>/verify</strong> again.</p>
      `));
    }

    res.send(page('Finish verification', `
      <h1>Finish Lifesteal verification</h1>
      <p>You are linking Discord account <strong>${escapeHtml(row.discord_id)}</strong> to Minecraft account <strong>${escapeHtml(row.minecraft_name)}</strong>.</p>
      <p>By continuing, you accept the current Lifesteal rules version <strong>${escapeHtml(currentRulesVersion())}</strong>.</p>
      <p class="warn">This stores a protected hash of your IP address to help enforce one user per account/IP and flag suspicious duplicate signups. Staff should disclose this in server rules/privacy notices.</p>
      <form method="post" action="/verify/${escapeHtml(token)}">
        <button type="submit">I consent and verify</button>
      </form>
      <p class="muted">The raw IP is not stored by this bot; only keyed hashes are saved.</p>
    `));
  });

  app.post('/verify/:token', async (req, res) => {
    if (config.requireVerificationConsent !== true) {
      return res.status(403).send(page('Consent required', '<h1>Consent required</h1><p>Verification consent is disabled by configuration.</p>'));
    }

    try {
      const result = await completeVerification(client, req.params.token, clientIp(req));
      const warning = result.suspicious
        ? `<p class="warn">Your account was verified, but it was flagged for staff review: ${escapeHtml(result.suspiciousReason)}</p>`
        : '';
      res.send(page('Verified', `
        <h1>Verified</h1>
        <p>Your Discord account is linked to <strong>${escapeHtml(result.minecraftName)}</strong>. You can close this tab.</p>
        ${warning}
      `));
    } catch (error) {
      res.status(400).send(page('Verification failed', `
        <h1>Verification failed</h1>
        <p>${escapeHtml(error.message)}</p>
      `));
    }
  });

  app.get('/api/v1/link/discord/:discordId', requireApiSecret, (req, res) => {
    const linked = statements.findLinkedByDiscord.get(req.params.discordId);
    res.json({ linked: linked ?? null });
  });

  app.get('/api/v1/overlays/lifesteal/player', requireOverlayToken, (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const player = statements.getOverlayLifestealPlayer.get();
    res.json({
      ok: true,
      configured: Boolean(config.overlay.lifestealPlayerUuid),
      player
    });
  });

  app.post('/api/v1/minecraft/join', requireApiSecret, async (req, res) => {
    const body = minecraftJoinSchema.parse(req.body);
    statements.recordMinecraftName.run({
      minecraftUuid: body.minecraftUuid,
      username: body.minecraftName,
      seenAt: Date.now()
    });
    const linked = findLinkedMinecraftAccount(body.minecraftUuid);
    if (!linked) return res.status(404).json({ allowed: false, reason: 'Minecraft account is not linked.' });
    if (linked.status !== 'active') return res.status(403).json({ allowed: false, reason: `Link status is ${linked.status}.` });

    const rules = statements.findRulesAcceptance.get(linked.discord_id);
    if (!rules || rules.rules_version !== currentRulesVersion()) {
      audit('minecraft.join_rejected', {
        discordId: linked.discord_id,
        minecraftUuid: linked.minecraft_uuid,
        data: { reason: 'rules_not_accepted', currentRulesVersion: currentRulesVersion() }
      });
      return res.status(403).json({ allowed: false, reason: `Accept rules version ${currentRulesVersion()} in Discord first.` });
    }

    const risk = await refreshRisk(client, linked);
    if (risk.score >= 80) {
      audit('minecraft.join_rejected', {
        discordId: linked.discord_id,
        minecraftUuid: linked.minecraft_uuid,
        data: { reason: 'high_risk', riskScore: risk.score, riskBand: risk.band }
      });
      return res.status(403).json({ allowed: false, reason: `Account requires staff review. Risk score ${risk.score}.` });
    }

    if (body.ip) {
      const { ipHash } = ipHashes(body.ip);
      if (linked.ip_hash && linked.ip_hash !== ipHash) {
        statements.setLinkedStatus.run({
          discordId: linked.discord_id,
          status: 'review',
          suspicious: 1,
          reason: 'Minecraft join IP does not match verification IP hash'
        });
        audit('minecraft.ip_mismatch', {
          discordId: linked.discord_id,
          minecraftUuid: linked.minecraft_uuid,
          ipHash,
          data: { minecraftName: body.minecraftName }
        });
        audit('minecraft.join_rejected', {
          discordId: linked.discord_id,
          minecraftUuid: linked.minecraft_uuid,
          ipHash,
          data: { reason: 'ip_lock_mismatch', minecraftName: body.minecraftName }
        });
        return res.status(403).json({ allowed: false, reason: 'IP lock mismatch; staff review required.' });
      }
    }

    audit('minecraft.join_allowed', {
      discordId: linked.discord_id,
      minecraftUuid: linked.minecraft_uuid,
      ipHash: body.ip ? ipHashes(body.ip).ipHash : null,
      data: { minecraftName: body.minecraftName }
    });
    await minecraftLog(client, 'Minecraft Join Allowed', [
      { name: 'Discord', value: `<@${linked.discord_id}>`, inline: true },
      { name: 'Minecraft', value: body.minecraftName, inline: true },
      { name: 'Risk', value: String(risk.score), inline: true }
    ]);
    res.json({ allowed: true, discordId: linked.discord_id, status: linked.status, riskScore: risk.score, rulesVersion: currentRulesVersion() });
  });

  app.post('/api/v1/minecraft/event', requireApiSecret, async (req, res) => {
    try {
      const body = minecraftEventSchema.parse(req.body);
      const linked = body.minecraftUuid ? findLinkedMinecraftAccount(body.minecraftUuid) : null;
      audit(`minecraft.event.${body.type}`, {
        discordId: linked?.discord_id ?? null,
        minecraftUuid: body.minecraftUuid ?? linked?.minecraft_uuid ?? null,
        data: {
          minecraftName: body.minecraftName ?? linked?.minecraft_name ?? null,
          severity: body.severity,
          message: body.message,
          ...(body.data ?? {})
        }
      });

      const log = body.severity === 'info' ? minecraftLog : securityLog;
      await log(client, `Minecraft ${body.severity.toUpperCase()}: ${body.type}`, [
        { name: 'Discord', value: linked ? `<@${linked.discord_id}>` : 'Unknown', inline: true },
        { name: 'Minecraft', value: body.minecraftName ?? linked?.minecraft_name ?? 'Unknown', inline: true },
        { name: 'Message', value: body.message }
      ]);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/v1/minecraft/link', requireApiSecret, async (req, res) => {
    try {
      const body = minecraftLinkSchema.parse(req.body);
      statements.recordMinecraftName.run({
        minecraftUuid: body.minecraftUuid,
        username: body.minecraftName,
        seenAt: Date.now()
      });
      const result = await completeMinecraftLink(client, body.code, body.minecraftUuid, body.minecraftName, body.ip ?? clientIp(req));
      res.json({
        ok: true,
        discordId: result.discordId,
        minecraftName: result.minecraftName,
        riskScore: result.riskScore,
        riskBand: result.riskBand,
        requiresReview: result.riskScore >= 80
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/v1/gameplay/roles/sync', requireApiSecret, async (req, res) => {
    try {
      const body = gameplayRoleSyncSchema.parse(req.body);
      const overlay = saveOverlayLifestealPlayer(body.players);
      const stats = await syncGameplayRoles(client, body.players);
      audit('gameplay.roles_sync', { data: { ...stats, overlay } });
      res.json({ ok: true, overlay, ...stats });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.listen(config.port, () => {
    console.log(`Verification/API server listening on http://localhost:${config.port}`);
  });
}
