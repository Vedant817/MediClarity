export const MAX_REPORT_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_BODY_BYTES = MAX_REPORT_BYTES + 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function hasValidMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
  if (mimeType === "image/jpeg") {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mimeType === "image/png") {
    return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === "image/webp") {
    return (
      hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

export async function validateReportFile(file: File): Promise<Uint8Array> {
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Only PDF, JPEG, PNG, and WebP reports are supported");
  }
  if (file.size <= 0 || file.size > MAX_REPORT_BYTES) {
    throw new Error("Report must be between 1 byte and 15 MB");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidMagicBytes(bytes, file.type)) {
    throw new Error("File contents do not match the declared report type");
  }
  return bytes;
}

export function safeUploadFileName(name: string): string {
  const baseName = name.replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  return baseName.slice(0, 120) || "medical-report";
}

export function assertOwnedCloudinaryDocumentUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    throw new Error("Document URL is required");
  }

  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Document URL must be a MediClarity Cloudinary HTTPS URL");
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("Cloudinary is not configured");
  }
  const firstPathSegment = url.pathname.split("/").filter(Boolean)[0];
  if (firstPathSegment !== cloudName) {
    throw new Error("Document URL is not owned by this MediClarity deployment");
  }

  return url;
}
