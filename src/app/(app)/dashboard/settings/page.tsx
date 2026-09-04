"use client";

import { useEffect, useState } from "react";
import { CreditCard, Globe, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const languages = { en: "English", hi: "Hindi", es: "Spanish", ar: "Arabic", pt: "Portuguese", fr: "French", pa: "Punjabi" } as const;
const regions = { GLOBAL: "Global / source-lab defaults", IN: "India deployment profile", US: "United States deployment profile", EU: "European Union deployment profile", GCC: "GCC deployment profile" } as const;
type Preferences = { locale: keyof typeof languages; regionProfile: keyof typeof regions; dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" };
const defaults: Preferences = { locale: "en", regionProfile: "GLOBAL", dateFormat: "YYYY-MM-DD" };

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [status, setStatus] = useState("");

  useEffect(() => { fetch("/api/settings").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.preferences) setPreferences(data.preferences) }); }, []);

  async function save() {
    setStatus("Saving…");
    const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences) });
    setStatus(response.ok ? "Preferences saved" : "Preferences could not be saved");
  }

  async function manageBilling() {
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const data = await response.json();
    if (response.ok) window.location.assign(data.url); else setStatus(data.error || "Billing portal is unavailable");
  }

  return (
    <main className="flex-1 p-4 md:p-8">
      <header className="mb-6 border-l-4 border-teal-600 pl-5"><p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">Account controls</p><h1 className="mt-2 text-3xl font-semibold">Settings</h1></header>
      <div className="mx-auto max-w-4xl space-y-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-teal-700" />Locale pack</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Language<select className="mt-2 w-full rounded-md border bg-white p-2" value={preferences.locale} onChange={(event) => setPreferences({ ...preferences, locale: event.target.value as Preferences["locale"] })}>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-medium">Date display<select className="mt-2 w-full rounded-md border bg-white p-2" value={preferences.dateFormat} onChange={(event) => setPreferences({ ...preferences, dateFormat: event.target.value as Preferences["dateFormat"] })}>{["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm font-medium md:col-span-2">Deployment requirements profile<select className="mt-2 w-full rounded-md border bg-white p-2" value={preferences.regionProfile} onChange={(event) => setPreferences({ ...preferences, regionProfile: event.target.value as Preferences["regionProfile"] })}>{Object.entries(regions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="flex items-center gap-3 md:col-span-2"><Button onClick={save} className="bg-teal-700 hover:bg-teal-800">Save preferences</Button><span className="text-sm text-slate-500" aria-live="polite">{status}</span></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-teal-700" />Deployment and compliance boundary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-slate-600"><p>Profiles record customer requirements; they do not certify compliance. The current hosted product provides authenticated access, expiring shares, and access logs.</p><p>Data residency, DPDP/GDPR operating processes, a US HIPAA BAA, and private-VPC/on-prem deployment require separate infrastructure and contracts before they can be claimed.</p></CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-teal-700" />Billing</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-slate-600">Manage payment methods, invoices, and subscription cancellation in Stripe’s customer portal.</p><Button variant="outline" onClick={manageBilling}>Manage billing</Button></CardContent></Card>
      </div>
    </main>
  );
}
