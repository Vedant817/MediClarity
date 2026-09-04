"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type KeyRecord = { _id: string; name: string; prefix: string; quota: number; monthlyUsage: number; usageMonth: string; lastUsedAt?: string };

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/api-keys");
    const data = await response.json();
    if (response.ok) setKeys(data.keys); else setError(data.error || "API keys could not be loaded");
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create(event: FormEvent) {
    event.preventDefault(); setError(""); setCreatedKey("");
    const response = await fetch("/api/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error); return; }
    setCreatedKey(data.key); setName(""); await refresh();
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="border-l-4 border-teal-600 pl-5"><p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">Lab Structure API</p><h1 className="mt-2 text-3xl font-semibold">API keys and usage</h1><p className="mt-2 text-slate-600">Turn a public report URL into normalized rows and FHIR Observations.</p></header>
      {error && <p className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      <form onSubmit={create} className="flex gap-3 border border-slate-200 bg-white p-5 shadow-sm"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Production importer" required /><Button className="bg-teal-700 hover:bg-teal-800"><KeyRound className="mr-2 h-4 w-4" />Create key</Button></form>
      {createdKey && <section className="border border-amber-300 bg-amber-50 p-5"><p className="font-semibold">Copy this key now. It will not be shown again.</p><div className="mt-3 flex items-center gap-2"><code className="min-w-0 flex-1 overflow-x-auto bg-white p-3 text-xs">{createdKey}</code><Button variant="outline" onClick={() => navigator.clipboard.writeText(createdKey)}><Copy className="h-4 w-4" /></Button></div></section>}
      <section className="divide-y border border-slate-200 bg-white shadow-sm">{keys.map((key) => <article key={key._id} className="flex items-center gap-4 p-5"><div className="flex-1"><h2 className="font-semibold">{key.name}</h2><p className="font-mono text-xs text-slate-500">{key.prefix}… · {key.monthlyUsage}/{key.quota} requests in {key.usageMonth}</p></div><Button variant="outline" onClick={() => revoke(key._id)}><Trash2 className="mr-2 h-4 w-4" />Revoke</Button></article>)}{keys.length === 0 && !error && <p className="p-8 text-center text-slate-500">No active API keys.</p>}</section>
      <section className="border border-slate-200 bg-slate-950 p-5 text-slate-100"><p className="font-mono text-xs uppercase tracking-wider text-cyan-300">Request</p><pre className="mt-3 overflow-x-auto text-xs leading-6">{`curl -X POST https://your-domain/api/v1/structure \\\n  -H "x-api-key: mc_live_…" \\\n  -H "content-type: application/json" \\\n  -d '{"documentUrl":"https://lab.example/report.pdf"}'`}</pre></section>
    </main>
  );
}
