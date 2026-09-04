import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getPatientVoiceContext } from "@/lib/patient-context";
import {
  consumeVoiceServiceNonce,
  verifyVoiceCapability,
  verifyVoiceServiceRequest,
} from "@/lib/voice-auth";

export const runtime = "nodejs";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  capabilityToken: z.string().min(64).max(4096),
}).strict();

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-voice-timestamp");
  const nonce = request.headers.get("x-voice-nonce");
  let authenticated = false;
  try {
    authenticated = verifyVoiceServiceRequest({
      method: request.method,
      pathname: request.nextUrl.pathname,
      timestamp,
      nonce,
      signature: request.headers.get("x-voice-signature"),
      body: rawBody,
    });
  } catch {
    return NextResponse.json({ error: "Voice service is unavailable" }, { status: 503 });
  }
  if (!authenticated || !nonce) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestBody: unknown;
  try {
    requestBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = requestSchema.safeParse(requestBody);
  if (!parsed.success) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let capability;
  try {
    capability = verifyVoiceCapability(parsed.data.capabilityToken);
  } catch {
    return NextResponse.json({ error: "Voice service is unavailable" }, { status: 503 });
  }
  if (!capability || capability.sid !== parsed.data.sessionId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    if (!await consumeVoiceServiceNonce(nonce)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const patientContext = await getPatientVoiceContext(capability.sub);
    return NextResponse.json(
      { sessionId: capability.sid, patientContext },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch {
    return NextResponse.json({ error: "Voice context is unavailable" }, { status: 503 });
  }
}
