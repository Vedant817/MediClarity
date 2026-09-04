import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export function isNonPublicAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  const mappedV4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedV4) return isNonPublicAddress(mappedV4);

  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const [first, second, third] = octets;
    return (
      first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0 && third === 0) ||
      (first === 192 && second === 0 && third === 2) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113)
    );
  }

  if (isIP(normalized) === 6) {
    return (
      normalized === "::" || normalized === "::1" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")
    );
  }
  return true;
}

export async function assertSafeDocumentUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Document URL must be a public HTTPS URL without credentials or a custom port");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("Private document URLs are not allowed");
  }

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isNonPublicAddress(entry.address))) {
    throw new Error("Document URL must resolve only to public addresses");
  }
  return url;
}
