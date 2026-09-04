import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createVoiceCapability, getVoiceWorkerUrl } from "@/lib/voice-auth";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sessionId = randomUUID();
    const { token, claims } = createVoiceCapability(userId, sessionId);
    return NextResponse.json(
      {
        sessionId,
        workerUrl: getVoiceWorkerUrl(),
        capabilityToken: token,
        expiresAt: new Date(claims.exp * 1000).toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Voice service is unavailable" }, { status: 503 });
  }
}

