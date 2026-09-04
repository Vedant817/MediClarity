"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pill, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Medication = { _id: string; name: string; dose?: string; frequency?: string; status: "active" | "stopped"; source: "ocr" | "manual" };
type Signal = { medicines: string[]; message: string; source: string };

export default function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [form, setForm] = useState({ name: "", dose: "", frequency: "" });

  const refresh = useCallback(async () => {
    const [medsResponse, signalsResponse] = await Promise.all([fetch("/api/meds"), fetch("/api/meds/interactions")]);
    if (medsResponse.ok) setMedications((await medsResponse.json()).medications);
    if (signalsResponse.ok) setSignals((await signalsResponse.json()).signals);
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
      <form onSubmit={addMedication} className="grid gap-3 border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_160px_1fr_auto]">
        <Input aria-label="Medicine name" placeholder="Medicine name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input aria-label="Dose" placeholder="Dose" value={form.dose} onChange={(event) => setForm({ ...form, dose: event.target.value })} />
        <Input aria-label="Frequency" placeholder="Frequency" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} />
        <Button className="bg-teal-700 hover:bg-teal-800">Add medicine</Button>
      </form>
      {signals.length > 0 && <section className="border border-amber-300 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-5 w-5" /> Review with a pharmacist</h2>{signals.map((signal) => <p key={signal.medicines.join("|")} className="mt-2 text-sm text-amber-950">{signal.message}</p>)}</section>}
      <section className="divide-y border border-slate-200 bg-white shadow-sm">
        {medications.map((medication) => <article key={medication._id} className="flex items-center gap-4 p-5"><Pill className="h-5 w-5 text-teal-700" /><div className="flex-1"><h2 className="font-semibold">{medication.name}</h2><p className="text-sm text-slate-600">{[medication.dose, medication.frequency].filter(Boolean).join(" · ") || "Dose not recorded"} · {medication.source}</p></div><Button variant="outline" onClick={() => toggleMedication(medication)}>{medication.status === "active" ? "Mark stopped" : "Mark active"}</Button></article>)}
        {medications.length === 0 && <p className="p-8 text-center text-slate-500">No medicines recorded. Add one or upload a report that lists medicines.</p>}
      </section>
      <p className="text-xs text-slate-500">For information only. This is not a prescription or a complete interaction checker.</p>
    </main>
  );
}
