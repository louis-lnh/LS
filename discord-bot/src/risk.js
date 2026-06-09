import { statements } from './db.js';
import { config } from './config.js';

export function riskBand(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'suspicious';
  if (score >= 25) return 'watch';
  return 'low';
}

export async function calculateRisk(client, linked) {
  const reasons = [];
  let score = 0;

  function add(points, reason) {
    score += points;
    reasons.push({ points, reason });
  }

  if (linked.ip_hash) {
    const sameIp = statements.findLinkedByIp.all(linked.ip_hash, linked.discord_id)
      .filter((row) => !statements.hasSharedIpException.get(linked.discord_id, row.discord_id));
    if (sameIp.length > 0) add(50, `same full IP hash as ${sameIp.length} linked account(s)`);

    const riskyIp = statements.findLinkedByIpAny.all(linked.ip_hash)
      .filter((row) =>
        row.discord_id !== linked.discord_id &&
        ['banned', 'review'].includes(row.status) &&
        !statements.hasSharedIpException.get(linked.discord_id, row.discord_id)
      );
    if (riskyIp.length > 0) add(60, `same IP hash as ${riskyIp.length} banned/review account(s)`);
  }

  if (linked.ip_prefix_hash) {
    const samePrefix = statements.findLinkedByPrefix.all(linked.ip_prefix_hash, linked.discord_id)
      .filter((row) => !statements.hasSharedIpException.get(linked.discord_id, row.discord_id));
    if (samePrefix.length > 0) add(20, `same IP prefix hash as ${samePrefix.length} linked account(s)`);
  }

  const history = statements.findMinecraftHistory.all(linked.minecraft_uuid)
    .filter((row) => row.discord_id !== linked.discord_id);
  if (history.length > 0) add(40, 'Minecraft account was previously linked to another Discord account');

  const cases = statements.findCasesForAccount.all(linked.discord_id, linked.minecraft_uuid);
  if (cases.length > 0) add(15, `${cases.length} previous moderation case(s)`);

  if (linked.suspicious) add(50, linked.suspicious_reason || 'manual staff flag');
  if (linked.status === 'review') add(50, 'account is under staff review');
  if (linked.status === 'banned') add(80, 'account is banned');

  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  const member = guild ? await guild.members.fetch(linked.discord_id).catch(() => null) : null;
  if (member) {
    const accountAgeMs = Date.now() - Number(member.user.createdTimestamp ?? 0);
    const guildAgeMs = Date.now() - Number(member.joinedTimestamp ?? 0);
    if (accountAgeMs < 7 * 24 * 60 * 60 * 1000) add(25, 'Discord account is under 7 days old');
    else if (accountAgeMs < 30 * 24 * 60 * 60 * 1000) add(10, 'Discord account is under 30 days old');
    if (guildAgeMs < 10 * 60 * 1000) add(15, 'verified within 10 minutes of joining Discord');
  }

  const appeals = statements.findAppealsForAccount.all(linked.discord_id, linked.minecraft_uuid);
  if (appeals.some((appeal) => appeal.status === 'accepted')) add(-20, 'successful appeal / staff cleared');

  score = Math.max(0, score);
  return { score, band: riskBand(score), reasons };
}

export async function refreshRisk(client, linked) {
  const risk = await calculateRisk(client, linked);
  statements.upsertRisk.run({
    discordId: linked.discord_id,
    score: risk.score,
    band: risk.band,
    reasons: risk.reasons
  });
  return risk;
}

export function formatRiskReasons(reasons) {
  if (!reasons?.length) return 'No risk reasons.';
  return reasons.map((reason) => `${reason.points >= 0 ? '+' : ''}${reason.points}: ${reason.reason}`).join('\n');
}
