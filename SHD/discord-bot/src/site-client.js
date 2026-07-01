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

export async function sitePatch(path, payload, actorId) {
  return siteRequest('PATCH', path, payload, actorId);
}

export async function siteDelete(path, actorId) {
  return siteRequest('DELETE', path, undefined, actorId);
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

  const rawBody = await response.text();
  let data = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    data = {};
  }

  if (!response.ok || data.ok === false) {
    const detail = data.error || data.message || rawBody;
    const routeHint = `${method} ${new URL(url).pathname}`;
    if (response.status === 404) {
      throw new Error(`Site API endpoint not found (${routeHint}). Check that SHD_SITE_INTERNAL_API_BASE_URL points to the deployed SHD site and that the site deployment includes /api/internal/bot routes.`);
    }
    throw new Error(detail || `SHD site API request failed with ${response.status} (${routeHint}).`);
  }
  return data;
}
