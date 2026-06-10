import { createHash } from "crypto";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidSessionId(sessionId: unknown): sessionId is string {
    return typeof sessionId === "string" && SESSION_ID_PATTERN.test(sessionId);
}

export function getUserVectorNamespace(userId: string, sessionId: string) {
    const digest = createHash("sha256")
        .update(`${userId}:${sessionId}`)
        .digest("hex")
        .slice(0, 32);

    return `user-${digest}`;
}
