"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Brand = { organizationName: string; logoUrl: string; accentColor: string };
const defaults: Brand = { organizationName: "", logoUrl: "", accentColor: "#0f766e" };

export default function LabBrandPage() {
  const [brand, setBrand] = useState<Brand>(defaults);
  const [status, setStatus] = useState("Loading…");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    fetch("/api/lab-brand").then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || "Brand settings could not be loaded");
        return;
      }
      if (data.brand) setBrand({ ...defaults, ...data.brand });
      setCanEdit(true);
      setStatus("");
    }).catch(() => setStatus("Brand settings could not be loaded"));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("Saving…");
    const response = await fetch("/api/lab-brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    });
    const data = await response.json();
    setStatus(response.ok ? "Brand settings saved" : data.error || "Brand settings could not be saved");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="border-l-4 border-teal-600 pl-5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">Lab plan</p>
        <h1 className="mt-2 text-3xl font-semibold">Shared-report branding</h1>
        <p className="mt-2 text-slate-600">Add your organization identity to public report links. Custom domains are not included.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <form onSubmit={save} className="space-y-5 border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium">Organization name
            <Input className="mt-2" value={brand.organizationName} onChange={(event) => setBrand({ ...brand, organizationName: event.target.value })} minLength={2} maxLength={80} required disabled={!canEdit} />
          </label>
          <label className="block text-sm font-medium">Logo URL <span className="font-normal text-slate-500">(optional, HTTPS)</span>
            <Input className="mt-2" type="url" inputMode="url" placeholder="https://lab.example/logo.png" value={brand.logoUrl} onChange={(event) => setBrand({ ...brand, logoUrl: event.target.value })} disabled={!canEdit} />
          </label>
          <label className="block text-sm font-medium">Accent color
            <span className="mt-2 flex items-center gap-3"><input className="h-10 w-14 rounded border p-1" type="color" value={brand.accentColor} onChange={(event) => setBrand({ ...brand, accentColor: event.target.value })} disabled={!canEdit} aria-label="Accent color picker" /><Input aria-label="Accent color hex value" value={brand.accentColor} pattern="#[0-9a-fA-F]{6}" onChange={(event) => setBrand({ ...brand, accentColor: event.target.value })} disabled={!canEdit} /></span>
          </label>
          <div className="flex items-center gap-3"><Button type="submit" className="bg-teal-700 hover:bg-teal-800" disabled={!canEdit}>Save branding</Button><span className="text-sm text-slate-500" aria-live="polite">{status}</span></div>
        </form>

        <section className="border border-slate-200 bg-slate-50 p-6" aria-label="Brand preview">
          <p className="font-mono text-xs uppercase tracking-wider text-slate-500">Public share preview</p>
          <div className="mt-4 border-l-4 bg-white p-5 shadow-sm" style={{ borderLeftColor: brand.accentColor }}>
            {brand.logoUrl ? <Image className="mb-4 h-auto max-h-12 w-auto max-w-48 object-contain" src={brand.logoUrl} width={192} height={48} unoptimized alt={`${brand.organizationName || "Organization"} logo`} /> : <Building2 className="mb-4 h-9 w-9" style={{ color: brand.accentColor }} />}
            <p className="text-sm font-semibold" style={{ color: brand.accentColor }}>{brand.organizationName || "Your laboratory"}</p>
            <h2 className="mt-1 text-xl font-semibold">Lab report overview</h2>
            <p className="mt-3 text-xs text-slate-500">Structured and shared securely through MediClarity.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
