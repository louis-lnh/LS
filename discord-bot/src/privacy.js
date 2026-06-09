import crypto from 'node:crypto';
import { config } from './config.js';

export function clientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwarded = raw?.split(',')[0]?.trim();
  return firstForwarded || req.socket.remoteAddress || 'unknown';
}

export function normalizeIp(ip) {
  return ip.replace(/^::ffff:/, '').trim().toLowerCase();
}

export function ipPrefix(ip) {
  const normalized = normalizeIp(ip);
  if (normalized.includes(':')) return normalized.split(':').slice(0, 4).join(':');
  return normalized.split('.').slice(0, 3).join('.');
}

export function hashPrivate(value) {
  return crypto
    .createHmac('sha256', config.ipHashSecret)
    .update(value)
    .digest('hex');
}

export function ipHashes(ip) {
  const normalized = normalizeIp(ip);
  return {
    ipHash: hashPrivate(normalized),
    ipPrefixHash: hashPrivate(ipPrefix(normalized))
  };
}
