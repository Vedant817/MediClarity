import { after } from "next/server";
import { readPublicShare, writeAuditLog } from "@/lib/share";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await readPublicShare(token);
  if (!data) return Response.json({ error: "Share link expired or unavailable" }, { status: 410 });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  after(() => writeAuditLog({
    action: "view",
    resourceId: String(data.report._id),
    resourceType: "report",
    ip: forwarded,
    userAgent: request.headers.get("user-agent"),
    metadata: { shareId: String(data.share._id) },
  }));

  return Response.json({ report: data.report, labs: data.labs, expiresAt: data.share.expiresAt });
}
