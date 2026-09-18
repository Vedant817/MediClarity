// Isolated Workers AI probe. Not part of the patient voice Durable Object.
// Start with `npm run probe:nova` and POST a 16 kHz mono WAV body.
interface ProbeEnv {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: ProbeEnv): Promise<Response> {
    if (request.method !== "POST" || !request.body) return new Response("POST a WAV", { status: 405 });
    const language = new URL(request.url).searchParams.get("language") ?? "en-IN";
    const result = await env.AI.run("@cf/deepgram/nova-3", {
      audio: { body: request.body, contentType: "audio/wav" },
      language,
      mode: "general",
      smart_format: true,
      measurements: true,
      mip_opt_out: true,
      keyterm: ["HbA1c", "Metformin XR"],
    } as unknown as Ai_Cf_Deepgram_Nova_3_Input);
    return Response.json(result);
  },
} satisfies ExportedHandler<ProbeEnv>;
