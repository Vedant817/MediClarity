import { notFound } from "next/navigation";
import Image from "next/image";
import { headers } from "next/headers";
import { after } from "next/server";
import { readPublicShare, writeAuditLog } from "@/lib/share";

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await readPublicShare(token);
  if (!data) notFound();
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  after(() => writeAuditLog({
    action: "view",
    resourceId: String(data.report._id),
    resourceType: "report",
    ip: forwardedFor,
    userAgent: requestHeaders.get("user-agent"),
    metadata: { shareId: String(data.share._id), surface: "public_share_page" },
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="border-l-4 bg-white p-6 shadow-sm" style={{ borderLeftColor: data.brand?.accentColor || "#0f766e" }}>
          {data.brand?.logoUrl && <Image className="mb-4 h-auto max-h-14 w-auto max-w-56 object-contain" src={data.brand.logoUrl} width={224} height={56} unoptimized alt={`${data.brand.organizationName} logo`} />}
          <p className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: data.brand?.accentColor || "#0f766e" }}>{data.brand?.organizationName || "Shared health record"}</p>
          <h1 className="mt-2 text-3xl font-semibold">Lab report overview</h1>
          <p className="mt-2 text-sm text-slate-600">Available until {new Date(data.share.expiresAt).toLocaleDateString()}</p>
          {data.brand && <p className="mt-3 text-xs text-slate-500">Structured and shared securely through MediClarity.</p>}
        </header>

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3 font-mono text-xs uppercase tracking-wider text-slate-500">
            Structured results
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr><th className="px-5 py-3">Test</th><th className="px-5 py-3">Result</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody>
                {data.labs.map((lab: { _id: unknown; canonicalName?: string; test: string; value: number; unit?: string; refMin?: number; refMax?: number; flag: "normal" | "high" | "low" | "unknown" }) => (
                  <tr key={String(lab._id)} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium">{lab.canonicalName || lab.test}</td>
                    <td className="px-5 py-3 font-mono">{lab.value} {lab.unit}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{lab.refMin ?? "—"}–{lab.refMax ?? "—"}</td>
                    <td className={`px-5 py-3 font-semibold ${lab.flag === "normal" ? "text-teal-700" : lab.flag === "unknown" ? "text-slate-500" : "text-rose-700"}`}>{lab.flag}</td>
                  </tr>
                ))}
                {data.labs.length === 0 && <tr><td className="px-5 py-8 text-slate-500" colSpan={4}>No structured lab rows were extracted from this report.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Plain-language summary</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{data.report.summary}</p>
        </section>

        <p className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          For information only, not medical advice. A qualified clinician should interpret these results in full clinical context.
        </p>
      </div>
    </main>
  );
}
