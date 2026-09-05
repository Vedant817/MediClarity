const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isValidShareToken(value: unknown): value is string {
  return typeof value === "string" && SHARE_TOKEN_PATTERN.test(value);
}
