import { auth } from "@clerk/nextjs/server";
import connectDB from "@/lib/db";
import Medication from "@/models/medication";
import { getEntitlements } from "@/lib/entitlements";

type OpenFdaLabel = { drug_interactions?: string[]; warnings?: string[]; warnings_and_cautions?: string[] };

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getEntitlements(userId)).medications) return Response.json({ error: "Medication tools require Pro", upgradeUrl: "/#pricing" }, { status: 402 });
  await connectDB();
  const medications = await Medication.find({ userId, status: "active" }).select({ name: 1 }).limit(10).lean<Array<{ _id: unknown; name: string }>>();

  const signals = (await Promise.all(medications.map(async (medication) => {
    const query = encodeURIComponent(`openfda.brand_name:"${medication.name.replaceAll('"', "")}"`);
    try {
      const response = await fetch(`https://api.fda.gov/drug/label.json?search=${query}&limit=1`, {
        signal: AbortSignal.timeout(5_000),
        next: { revalidate: 86_400 },
      });
      if (!response.ok) return [];
      const payload = await response.json() as { results?: OpenFdaLabel[] };
      const label = payload.results?.[0];
      const text = [...(label?.drug_interactions ?? []), ...(label?.warnings ?? []), ...(label?.warnings_and_cautions ?? [])].join(" ").toLowerCase();
      return medications
        .filter((other) => String(other._id) !== String(medication._id) && text.includes(other.name.toLowerCase()))
        .map((other) => ({ medicines: [medication.name, other.name], source: "FDA product label", message: `The ${medication.name} label mentions ${other.name}. Ask a pharmacist or clinician to review this combination.` }));
    } catch {
      return [];
    }
  }))).flat();

  const unique = Array.from(new Map(signals.map((signal) => [signal.medicines.slice().sort().join("|"), signal])).values());
  return Response.json({
    signals: unique,
    disclaimer: "Label text matching is not a complete interaction check. Do not start, stop, or change medication without a pharmacist or clinician.",
  });
}
