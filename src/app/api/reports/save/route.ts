import { auth } from "@clerk/nextjs/server";

/**
 * Derived report data used to be accepted from the browser here. That allowed
 * callers to persist fabricated OCR, summaries, and lab rows. All report
 * creation now goes through the server-owned multipart ingest endpoint.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(
    {
      error: "This endpoint no longer accepts report data. Use /api/reports/ingest.",
      code: "SERVER_OWNED_INGEST_REQUIRED",
    },
    { status: 410 },
  );
}
