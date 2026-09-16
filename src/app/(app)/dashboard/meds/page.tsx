"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Pill, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type MedicationReport = { _id: string; sourceLab: string | null; reportDate: string | null; createdAt: string };
type Medication = { _id: string; name: string; dose?: string; frequency?: string; status: "active" | "stopped"; source: "ocr" | "manual"; report?: MedicationReport | null };
type Signal = { medicines: string[]; message: string; source: string };

function reportLabel(report: MedicationReport) {
  const date = report.reportDate ?? report.createdAt;
  const formatted = new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return report.sourceLab ? `${report.sourceLab} · ${formatted}` : formatted;
}

export default function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [paywalled, setPaywalled] = useState(false);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [form, setForm] = useState({ name: "", dose: "", frequency: "" });

  // Medicines render first; the slower FDA interaction review streams in
  // afterwards so the list never waits on it — and the empty message only
  // appears after loading finishes, never as a flash.
  const refresh = useCallback(async () => {
    const medsResponse = await fetch("/api/meds");
    if (medsResponse.status === 402) { setPaywalled(true); setLoadingMeds(false); setLoadingSignals(false); return; }
    setPaywalled(false);
    if (medsResponse.ok) setMedications((await medsResponse.json()).medications);
    setLoadingMeds(false);
    const signalsResponse = await fetch("/api/meds/interactions");
    if (signalsResponse.ok) setSignals((await signalsResponse.json()).signals);
    setLoadingSignals(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function addMedication(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/meds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (response.ok) { setForm({ name: "", dose: "", frequency: "" }); await refresh(); }
  }

  async function toggleMedication(medication: Medication) {
    await fetch("/api/meds", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: medication._id, status: medication.status === "active" ? "stopped" : "active" }) });
    await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="border-l-4 border-teal-600 pl-5"><p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">Medication record</p><h1 className="mt-2 text-3xl font-semibold">Medicines found in reports</h1><p className="mt-2 text-slate-600">Confirm OCR-derived entries against the prescription or packaging.</p></header>
      {paywalled && (
        <section className="flex flex-col gap-3 border border-teal-700/30 bg-teal-50 p-5 sm:flex-row sm:items-center">
          <Crown className="h-6 w-6 shrink-0 text-teal-700" />
          <div className="flex-1">
            <h2 className="font-semibold text-teal-950">Medication tools need Pro</h2>
            <p className="mt-1 text-sm text-teal-900">Your plan does not include the medication record or interaction review. Upgrade to track medicines and check them against your reports.</p>
          </div>
          <Button asChild className="bg-teal-700 hover:bg-teal-800"><Link href="/pricing">Compare plans</Link></Button>
        </section>
      )}
      {!paywalled && (
      <form onSubmit={addMedication} className="grid gap-3 border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_160px_1fr_auto]">
        <Input aria-label="Medicine name" placeholder="Medicine name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input aria-label="Dose" placeholder="Dose" value={form.dose} onChange={(event) => setForm({ ...form, dose: event.target.value })} />
        <Input aria-label="Frequency" placeholder="Frequency" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} />
        <Button className="bg-teal-700 hover:bg-teal-800">Add medicine</Button>
      </form>
      )}
      {loadingSignals && !paywalled && <p className="text-xs text-slate-500" aria-live="polite">Checking medicine combinations against FDA labels…</p>}
      {signals.length > 0 && <section className="border border-amber-300 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-5 w-5" /> Review with a pharmacist</h2>{signals.map((signal) => <p key={signal.medicines.join("|")} className="mt-2 text-sm text-amber-950">{signal.message}</p>)}</section>}
      {!paywalled && (
      <section className="divide-y border border-slate-200 bg-white shadow-sm" aria-busy={loadingMeds}>
        {loadingMeds ? (
          <div className="space-y-4 p-5" aria-label="Loading medicines">
            {[0, 1, 2].map((index) => <div key={index} className="flex items-center gap-4"><Skeleton className="h-5 w-5 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-64" /></div><Skeleton className="h-9 w-28" /></div>)}
          </div>
        ) : (
          <>
            {medications.map((medication) => <article key={medication._id} className="flex items-center gap-4 p-5"><Pill className="h-5 w-5 text-teal-700" /><div className="flex-1"><h2 className="font-semibold">{medication.name}</h2><p className="text-sm text-slate-600">{[medication.dose, medication.frequency].filter(Boolean).join(" · ") || "Dose not recorded"} · {medication.source}</p>{medication.report ? <p className="mt-1 text-xs text-slate-500">From report · <Link href="/dashboard/reports" className="font-medium text-teal-700 hover:underline">{reportLabel(medication.report)}</Link></p> : medication.source === "ocr" ? <p className="mt-1 text-xs text-slate-500">From report · original report no longer available</p> : null}</div><Button variant="outline" onClick={() => toggleMedication(medication)}>{medication.status === "active" ? "Mark stopped" : "Mark active"}</Button></article>)}
            {medications.length === 0 && <p className="p-8 text-center text-slate-500">No medicines recorded. Add one or upload a report that lists medicines.</p>}
          </>
        )}
      </section>
      )}
      <p className="text-xs text-slate-500">For information only. This is not a prescription or a complete interaction checker.</p>
    </main>
  );
}
