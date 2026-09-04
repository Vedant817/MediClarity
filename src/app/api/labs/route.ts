import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import LabResult from "@/models/labResult";
import { getEntitlements } from "@/lib/entitlements";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entitlements = await getEntitlements(userId);
  if (!entitlements.trends) {
    return NextResponse.json({ error: "Lab trends require Pro", upgradeUrl: "/#pricing" }, { status: 402 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const canonicalName = searchParams.get("test")?.trim();
    const requestedLimit = Number(searchParams.get("limit") ?? 500);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500) : 500;
    const query = canonicalName ? { userId, canonicalName } : { userId };
    const documents = await LabResult.find(query).sort({ date: -1 }).limit(limit).lean();

    const labs = documents.map((lab) => ({
      id: String(lab._id),
      reportId: String(lab.reportId),
      test: lab.test,
      canonicalName: lab.canonicalName,
      value: lab.value,
      unit: lab.unit ?? null,
      refMin: lab.refMin ?? null,
      refMax: lab.refMax ?? null,
      flag: lab.flag,
      date: new Date(lab.date).toISOString(),
      source: lab.source,
      sourceLab: lab.sourceLab ?? null,
      sourceCountry: lab.sourceCountry ?? null,
      loinc: lab.loinc ?? null,
      original: lab.original,
      referenceRangeSource: lab.referenceRangeSource,
      normalization: lab.normalization,
      seriesKey: `${lab.canonicalName}::${lab.unit ?? "unitless"}`,
    }));

    if (searchParams.get("groupBy") === "test") {
      const grouped = labs.reduce<Record<string, typeof labs>>((result, lab) => {
        (result[lab.seriesKey] ??= []).push(lab);
        return result;
      }, {});
      return NextResponse.json({ labs, grouped });
    }

    return NextResponse.json({ labs });
  } catch (error) {
    console.error("Lab results fetch failed", error);
    return NextResponse.json({ error: "Failed to fetch lab results" }, { status: 500 });
  }
}
