import { config } from './config.js';

export function siteConfigured() {
  return Boolean(config.shdSite.internalBaseUrl && config.shdSite.internalToken);
}

export async function siteGet(path) {
  return siteRequest('GET', path);
}

export async function sitePost(path, payload, actorId) {
  return siteRequest('POST', path, payload, actorId);
}

async function siteRequest(method, path, payload, actorId) {
  if (!siteConfigured()) {
    throw new Error('SHD site internal API is not configured. Set SHD_SITE_INTERNAL_API_BASE_URL and SHD_SITE_INTERNAL_TOKEN.');
  }

  const url = `${config.shdSite.internalBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${config.shdSite.internalToken}`,
      'content-type': 'application/json',
      'x-shd-actor': actorId ?? 'discord-bot'
    },
    body: method === 'GET' ? undefined : JSON.stringify(payload ?? {})
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || `SHD site API request failed with ${response.status}.`);
  }
  return data;
}
