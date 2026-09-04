export interface ConnectionClaims {
  aud: string;
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  jti: string;
}

const encoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid token encoding");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function isClaims(value: unknown): value is ConnectionClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Record<string, unknown>;
  return (
    typeof claims.aud === "string" &&
    typeof claims.sub === "string" && claims.sub.length > 0 && claims.sub.length <= 160 &&
    typeof claims.sid === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(claims.sid) &&
    typeof claims.iat === "number" && Number.isInteger(claims.iat) &&
    typeof claims.exp === "number" && Number.isInteger(claims.exp) &&
    typeof claims.jti === "string" && claims.jti.length >= 16 && claims.jti.length <= 128
  );
}

export async function verifyConnectionToken(
  token: string,
  secret: string,
  expected: { audience: string; now?: number; lifetimeSeconds?: number },
): Promise<ConnectionClaims> {
  if (encoder.encode(secret).byteLength < 32) throw new Error("capability secret is too short");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new Error("malformed token");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader) as Record<string, unknown>;
  if (header.alg !== "HS256" || header.typ !== "JWT") throw new Error("unsupported token header");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(encodedSignature) as Uint8Array<ArrayBuffer>,
    encoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new Error("invalid signature");

  const claims = decodeJson(encodedPayload);
  if (!isClaims(claims)) throw new Error("invalid claims");
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  const lifetime = expected.lifetimeSeconds ?? 120;
  if (claims.aud !== expected.audience) throw new Error("invalid audience");
  if (claims.iat > now + 60 || claims.exp <= now) throw new Error("token not active");
  if (claims.exp - claims.iat !== lifetime) throw new Error("invalid token lifetime");
  return claims;
}

export function connectionTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  return new URL(request.url).searchParams.get("token");
}

export function agentInstanceName(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "agents") return null;
  try {
    return decodeURIComponent(parts[2]);
  } catch {
    return null;
  }
}
