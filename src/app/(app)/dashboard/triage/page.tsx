"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Result = { urgency: "low" | "medium" | "high"; timeframe: string; specialist: string; redFlags: string[]; selfCare: string[]; disclaimer: string };

export default function TriagePage() {
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: symptoms.split(",").map((value) => value.trim()).filter(Boolean), age: age ? Number(age) : undefined }),
    });
    setResult(response.ok ? await response.json() : null);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header className="border-l-4 border-teal-600 pl-5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">Care direction</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Where should I take these findings?</h1>
        <p className="mt-2 text-slate-600">Describe symptoms in plain language. This directs care; it does not diagnose.</p>
      </header>

      <form onSubmit={submit} className="space-y-4 border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">Symptoms, separated by commas
          <Input value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="chest pain, shortness of breath" className="mt-2" required />
        </label>
        <label className="block text-sm font-medium">Age (optional)
          <Input value={age} onChange={(event) => setAge(event.target.value)} type="number" min="0" max="120" className="mt-2 max-w-40" />
        </label>
        <Button disabled={loading} className="bg-teal-700 hover:bg-teal-800">{loading ? "Checking…" : "Check care urgency"}</Button>
      </form>

      {result && (
        <section className={`border-l-4 bg-white p-6 shadow-sm ${result.urgency === "high" ? "border-rose-600" : result.urgency === "medium" ? "border-amber-500" : "border-teal-600"}`}>
          <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5" /><span className="font-mono text-sm uppercase">{result.urgency} urgency</span></div>
          <h2 className="mt-4 text-2xl font-semibold">{result.timeframe}</h2>
          <p className="mt-2 flex items-center gap-2 text-slate-700"><Stethoscope className="h-4 w-4" /> {result.specialist}</p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-700">{result.redFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul>
          <Link href="/dashboard/appointments" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">View appointments <ArrowRight className="h-4 w-4" /></Link>
          <p className="mt-6 border-t pt-4 text-xs text-slate-500">{result.disclaimer}</p>
        </section>
      )}
    </main>
  );
}
