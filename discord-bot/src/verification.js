import crypto from 'node:crypto';
import { config } from './config.js';
import { statements, db } from './db.js';
import { ipHashes } from './privacy.js';
import { whitelistAdd } from './minecraft.js';
import { audit, verifyLog } from './logger.js';
import { refreshRisk } from './risk.js';
import { currentRulesVersion } from './settings.js';

const TOKEN_TTL_MS = 15 * 60 * 1000;

export function createVerification(discordId, minecraftProfile) {
  const now = Date.now();
  const token = crypto.randomBytes(24).toString('base64url');
  const linkCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  statements.createToken.run({
    token,
    linkCode,
    discordId,
    minecraftUuid: minecraftProfile.uuid,
    minecraftName: minecraftProfile.name,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS
  });
  return {
    token,
    linkCode,
    url: `${config.publicBaseUrl.replace(/\/$/, '')}/verify/${token}`,
    expiresAt: now + TOKEN_TTL_MS
  };
}

export async function completeVerification(client, token, ip) {
  const row = statements.getToken.get(token);
  return completeVerificationRow(client, row, ip);
}

export async function completeMinecraftLink(client, linkCode, minecraftUuid, minecraftName, ip) {
  const row = statements.getTokenByLinkCode.get(String(linkCode).trim().toUpperCase());
  if (!row) throw new Error('This link code does not exist.');
  if (normalizeUuid(row.minecraft_uuid) !== normalizeUuid(minecraftUuid)) {
    throw new Error('This link code was created for a different Minecraft account.');
  }
  return completeVerificationRow(client, row, ip, { minecraftName });
}

async function completeVerificationRow(client, row, ip, options = {}) {
  if (!row) throw new Error('This verification link does not exist.');
  if (row.used_at) throw new Error('This verification link has already been used.');
  if (Date.now() > row.expires_at) throw new Error('This verification link expired. Run /verify again.');

  const existingDiscord = statements.findLinkedByDiscord.get(row.discord_id);
  const existingMinecraft = statements.findLinkedByMinecraft.get(row.minecraft_uuid);
  if (existingDiscord && existingDiscord.minecraft_uuid !== row.minecraft_uuid) {
    throw new Error('Your Discord account is already linked to a different Minecraft account. Ask staff to unlink it first.');
  }
  if (existingMinecraft && existingMinecraft.discord_id !== row.discord_id) {
    throw new Error('That Minecraft account is already linked to another Discord account.');
  }

  const { ipHash, ipPrefixHash } = ipHashes(ip);
  const ipMatches = statements.findLinkedByIp.all(ipHash, row.discord_id);
  const suspiciousReasons = [];
  if (ipMatches.length > 0) {
    suspiciousReasons.push(`same IP hash as ${ipMatches.length} linked account(s)`);
  }

  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  const member = await guild?.members.fetch(row.discord_id).catch(() => null);
  const accountAgeMs = Date.now() - Number(member?.user.createdTimestamp ?? 0);
  const guildAgeMs = Date.now() - Number(member?.joinedTimestamp ?? 0);
  if (member && accountAgeMs < 7 * 24 * 60 * 60 * 1000) {
    suspiciousReasons.push('Discord account is under 7 days old');
  }
  if (member && guildAgeMs < 10 * 60 * 1000) {
    suspiciousReasons.push('Verified within 10 minutes of joining the Discord');
  }

  const suspicious = suspiciousReasons.length > 0 ? 1 : 0;
  const now = Date.now();

  db.transaction(() => {
    statements.upsertLinked.run({
      discordId: row.discord_id,
      minecraftUuid: row.minecraft_uuid,
      minecraftName: options.minecraftName ?? row.minecraft_name,
      discordUsername: member?.user.tag ?? null,
      ipHash,
      ipPrefixHash,
      verifiedAt: now,
      lastSeenAt: now,
      status: 'active',
      suspicious,
      suspiciousReason: suspiciousReasons.join('; ')
    });
    statements.upsertRulesAcceptance.run({
      discordId: row.discord_id,
      minecraftUuid: row.minecraft_uuid,
      rulesVersion: currentRulesVersion(),
      acceptedAt: now,
      source: 'verification_page'
    });
    statements.markTokenUsed.run(now, row.token);
  })();

  const linked = statements.findLinkedByDiscord.get(row.discord_id);
  const risk = await refreshRisk(client, linked);
  if (risk.score >= 80) {
    statements.setLinkedStatus.run({
      discordId: row.discord_id,
      status: 'review',
      suspicious: 1,
      reason: `High risk score ${risk.score}`
    });
  }

  audit('verification.completed', {
    discordId: row.discord_id,
    minecraftUuid: row.minecraft_uuid,
    ipHash,
    data: {
      minecraftName: row.minecraft_name,
      suspicious: Boolean(suspicious),
      suspiciousReason: suspiciousReasons.join('; '),
      rulesVersion: currentRulesVersion(),
      riskScore: risk.score,
      riskBand: risk.band
    }
  });

  if (member && config.verifiedRoleId) {
    await member.roles.add(config.verifiedRoleId, 'Completed Minecraft verification').catch(() => null);
  }
  if (member && config.suspiciousRoleId) {
    if (suspicious || risk.score >= 50) {
      await member.roles.add(config.suspiciousRoleId, `Risk ${risk.score}: ${risk.band}`).catch(() => null);
    } else {
      await member.roles.remove(config.suspiciousRoleId, 'Risk below suspicious threshold').catch(() => null);
    }
  }

  if (risk.score < 80) {
    await whitelistAdd(row.minecraft_name).catch((error) => {
      audit('minecraft.whitelist_failed', {
        discordId: row.discord_id,
        minecraftUuid: row.minecraft_uuid,
        data: { error: error.message }
      });
    });
  }

  await verifyLog(client, suspicious ? 'Suspicious Verification Completed' : 'Verification Completed', [
    { name: 'Discord', value: `<@${row.discord_id}>`, inline: true },
    { name: 'Minecraft', value: `${row.minecraft_name} (${row.minecraft_uuid})`, inline: true },
    { name: 'Risk', value: `${risk.score} (${risk.band})`, inline: true },
    { name: 'Suspicious', value: suspicious ? suspiciousReasons.join('; ') : 'No', inline: false }
  ]);

  return {
    discordId: row.discord_id,
    minecraftName: row.minecraft_name,
    suspicious: Boolean(suspicious),
    suspiciousReason: suspiciousReasons.join('; '),
    riskScore: risk.score,
    riskBand: risk.band
  };
}

function normalizeUuid(value) {
  return String(value ?? '').toLowerCase().replaceAll('-', '');
}
