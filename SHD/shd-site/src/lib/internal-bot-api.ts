import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

type JsonValue = Record<string, unknown>;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireBotAuth(request: NextRequest) {
  const expected = process.env.SHD_SITE_INTERNAL_TOKEN ?? "";
  if (!expected) {
    return Response.json(
      { ok: false, code: "INTERNAL_TOKEN_NOT_CONFIGURED", error: "SHD_SITE_INTERNAL_TOKEN is not configured." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  if (!safeEqual(token, expected)) {
    return Response.json(
      { ok: false, code: "INTERNAL_AUTH_REQUIRED", error: "Internal bot authorization required." },
      { status: 401 },
    );
  }

  return null;
}

export async function readJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as JsonValue;
  } catch {
    return null;
  }
}

export function requireString(body: JsonValue | null, field: string, maxLength = 500) {
  const value = body?.[field];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function acceptedScaffold(action: string, payload: JsonValue) {
  return Response.json({
    ok: true,
    action,
    persisted: false,
    mode: "scaffold",
    message: "Internal bot endpoint accepted the payload. Database persistence is the next backend slice.",
    payload,
    updatedAt: Date.now(),
  });
}
