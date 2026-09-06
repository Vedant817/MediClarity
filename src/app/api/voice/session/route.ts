import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createVoiceCapability, getVoiceWorkerUrl } from "@/lib/voice-auth";
import { randomUUID } from "node:crypto";
import { isVoiceLocale } from "@/config/voice-languages";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as { locale?: unknown };
    const locale = body.locale ?? "en-IN";
    if (!isVoiceLocale(locale)) {
      return NextResponse.json({ error: "Unsupported voice language" }, { status: 400 });
    }
    if (locale !== "en-IN" && process.env.VOICE_INDIC_ENABLED !== "true") {
      return NextResponse.json(
        { error: "Indian-language voice is not configured on this deployment" },
        { status: 503 },
      );
    }
    const sessionId = randomUUID();
    const { token, claims } = createVoiceCapability(userId, sessionId, locale);
    return NextResponse.json(
      {
        sessionId,
        workerUrl: getVoiceWorkerUrl(),
        capabilityToken: token,
        expiresAt: new Date(claims.exp * 1000).toISOString(),
        locale,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Voice service is unavailable" }, { status: 503 });
  }
}

