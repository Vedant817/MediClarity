"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, LineChart as LineChartIcon } from "lucide-react";
import Link from "next/link";
import TrendChart from "@/components/labs/TrendChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Lab = {
  id: string;
  reportId: string;
  test: string;
  canonicalName: string;
  value: number;
  unit: string | null;
  refMin: number | null;
  refMax: number | null;
  flag: "normal" | "high" | "low" | "unknown";
  date: string;
  source: string;
  sourceLab: string | null;
  sourceCountry: string | null;
  referenceRangeSource: "lab_provided" | "not_provided";
  normalization: { unitConverted: boolean; conversion?: string };
  seriesKey: string;
};

export default function TrendsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  useEffect(() => {
    fetch("/api/labs?groupBy=test")
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 402 || response.status === 403) setUpgradeRequired(true);
          throw new Error(response.status === 401 ? "Sign in to view lab trends." : response.status === 402 || response.status === 403 ? "Lab trends are included with Pro and Lab plans." : "Lab results could not be loaded.");
        }
        return response.json() as Promise<{ labs: Lab[] }>;
      })
      .then(({ labs: result }) => {
        setLabs(result);
        const counts = new Map<string, number>();
        result.forEach((lab) => counts.set(lab.seriesKey, (counts.get(lab.seriesKey) ?? 0) + 1));
        setSelected([...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "");
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const series = useMemo(() => labs.filter((lab) => lab.seriesKey === selected), [labs, selected]);
  const options = useMemo(() => [...new Map(labs.map((lab) => [lab.seriesKey, lab])).values()].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName)), [labs]);
  const active = series[0];

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><LineChartIcon className="h-6 w-6 text-teal-600" /> Lab trends</h1>
          <p className="mt-1 text-sm text-gray-600">Compare repeated measurements after transparent name and unit normalization.</p>
        </div>

        {error && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-4 w-4" /><span>{error}</span>{upgradeRequired && <Link className="ml-auto font-semibold underline" href="/#pricing">View plans</Link>}</div>}
        {loading && <div className="h-64 animate-pulse rounded-xl bg-gray-100" />}
        {!loading && !error && labs.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-gray-500">No structured lab results yet. Upload a lab report to begin.</div>}

        {!loading && labs.length > 0 && (
          <>
            <Card>
              <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <CardTitle>{active?.canonicalName ?? "Choose a test"}</CardTitle>
                  <CardDescription>{series.length} result{series.length === 1 ? "" : "s"} in {active?.unit ?? "the lab's reported unit"}</CardDescription>
                </div>
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger className="w-full md:w-72" aria-label="Lab test"><SelectValue placeholder="Choose a test" /></SelectTrigger>
                  <SelectContent>{options.map((lab) => <SelectItem key={lab.seriesKey} value={lab.seriesKey}>{lab.canonicalName} ({lab.unit ?? "unitless"})</SelectItem>)}</SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <TrendChart points={series} unit={active?.unit ?? null} />
                <p className="mt-3 text-xs text-gray-500">Dashed lines use a reference range printed by a source lab. Ranges can vary by lab, method, age, and sex; MediClarity does not substitute a regional clinical range.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Unified results</CardTitle><CardDescription>Original values remain stored for provenance. Converted values show their conversion below.</CardDescription></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-gray-500"><tr><th className="py-3">Date</th><th>Test</th><th>Result</th><th>Reported range</th><th>Status</th><th>Source</th></tr></thead>
                  <tbody>{labs.map((lab) => (
                    <tr key={lab.id} className={lab.flag === "normal" ? "border-b" : "border-b bg-red-50/60"}>
                      <td className="py-3">{new Date(lab.date).toLocaleDateString()}</td>
                      <td><div className="font-medium">{lab.canonicalName}</div>{lab.test !== lab.canonicalName && <div className="text-xs text-gray-500">printed: {lab.test}</div>}</td>
                      <td><div>{lab.value} {lab.unit}</div>{lab.normalization.unitConverted && <div className="text-xs text-gray-500">{lab.normalization.conversion}</div>}</td>
                      <td>{lab.referenceRangeSource === "lab_provided" ? `${lab.refMin ?? "–"}–${lab.refMax ?? "–"} ${lab.unit ?? ""}` : "Not printed"}</td>
                      <td><Badge variant={lab.flag === "high" || lab.flag === "low" ? "destructive" : "secondary"}>{lab.flag}</Badge></td>
                      <td>{lab.sourceLab ?? lab.source}{lab.sourceCountry ? ` · ${lab.sourceCountry}` : ""}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </CardContent>
            </Card>
            <p className="text-xs text-gray-500">For information only, not medical advice. Discuss results and reference ranges with a qualified clinician.</p>
          </>
        )}
      </div>
    </main>
  );
}
