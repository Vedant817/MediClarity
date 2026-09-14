/**
 * Resolve a post-login destination from a `redirect_url` query value.
 * Only same-origin app paths are allowed (`/pricing`, `/dashboard/...`);
 * protocol-relative (`//evil`), absolute (`https:`), and backslash values
 * fall back to the dashboard. Prevents open-redirect abuse.
 */
export function safeRedirectTarget(value: string | null | undefined): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }
  return "/dashboard";
}
