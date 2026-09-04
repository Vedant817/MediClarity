import { auth } from "@clerk/nextjs/server";
import { getLLM } from "@/lib/llm";
import { applyDeterministicSafetyRules, hasEmergencySignal, TRIAGE_RULESET_VERSION, triageInputSchema, triageResultSchema } from "@/lib/triage";
import { getEntitlements } from "@/lib/entitlements";

function responseText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => typeof part === "string" ? part : (part as { text?: string }).text || "").join("");
  return String(content ?? "");
}

function jsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Triage model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getEntitlements(userId)).triage) {
    return Response.json({ error: "Care direction requires Pro", upgradeUrl: "/#pricing" }, { status: 402 });
  }
  const input = triageInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid triage input" }, { status: 400 });

  const prompt = `You are a conservative health triage assistant, not a doctor. Never diagnose or say the user has a disease.
Return JSON only with: urgency (low|medium|high), timeframe, specialist, redFlags (string[]), selfCare (string[]), disclaimer.
Escalate possible emergencies. Do not use reassuring language to minimize red flags.
Symptoms: ${JSON.stringify(input.data.symptoms)}
Age: ${input.data.age ?? "not provided"}; sex: ${input.data.sex ?? "not provided"}
Abnormal lab labels: ${JSON.stringify(input.data.abnormalLabs)}
The disclaimer must state that this is information only, not medical advice or diagnosis.`;

  try {
    const result = await getLLM("triage").invoke(prompt);
    const parsed = triageResultSchema.parse(jsonObject(responseText(result.content)));
    return Response.json(applyDeterministicSafetyRules(input.data, parsed));
  } catch (error) {
    console.error("Triage generation failed", error);
    if (hasEmergencySignal(input.data)) {
      return Response.json({
        status: "degraded",
        rulesetVersion: TRIAGE_RULESET_VERSION,
        urgency: "high",
        timeframe: "Seek emergency care now",
        specialist: "Emergency care",
        redFlags: ["Call your local emergency number now if symptoms are current, severe, worsening, or accompanied by sweating, fainting, confusion, or blue lips."],
        selfCare: ["Do not drive yourself if symptoms are severe. Follow instructions from local emergency services."],
        disclaimer: "The care-direction service is unavailable. This emergency warning is a conservative safety rule, not medical advice or a diagnosis.",
      }, { status: 503 });
    }
    return Response.json({
      status: "unavailable",
      error: "Care direction is temporarily unavailable. If symptoms are severe, sudden, or worsening, contact local emergency services.",
      disclaimer: "No clinical assessment was generated.",
    }, { status: 503 });
  }
}
