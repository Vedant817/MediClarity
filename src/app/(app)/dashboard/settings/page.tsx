"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { CreditCard, Crown, Globe, LogOut, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOICE_LANGUAGES, type PreferenceLocale } from "@/config/voice-languages";

const languages = Object.fromEntries(
  VOICE_LANGUAGES.map((language) => [language.preference, `${language.label} · ${language.nativeLabel}`]),
) as Record<PreferenceLocale, string>;
const regions = { GLOBAL: "Global / source-lab defaults", IN: "India deployment profile", US: "United States deployment profile", EU: "European Union deployment profile", GCC: "GCC deployment profile" } as const;
type Preferences = { locale: keyof typeof languages; regionProfile: keyof typeof regions; dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" };
const defaults: Preferences = { locale: "en", regionProfile: "GLOBAL", dateFormat: "YYYY-MM-DD" };

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [status, setStatus] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number | null } | null>(null);
  const { signOut } = useClerk();

  useEffect(() => { fetch("/api/settings").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.preferences) setPreferences(data.preferences) }); }, []);
  useEffect(() => {
    fetch("/api/user-data")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.plan) setPlan(String(data.plan));
        if (data?.reportQuota) setQuota(data.reportQuota);
      })
      .catch(() => null);
  }, []);

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
          <label className="text-sm font-medium">Language
            <Select value={preferences.locale} onValueChange={(value) => setPreferences({ ...preferences, locale: value as Preferences["locale"] })}>
              <SelectTrigger className="mt-2 w-full" aria-label="Language"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(languages).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="text-sm font-medium">Date display
            <Select value={preferences.dateFormat} onValueChange={(value) => setPreferences({ ...preferences, dateFormat: value as Preferences["dateFormat"] })}>
              <SelectTrigger className="mt-2 w-full" aria-label="Date display"><SelectValue /></SelectTrigger>
              <SelectContent>{["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="text-sm font-medium md:col-span-2">Deployment requirements profile
            <Select value={preferences.regionProfile} onValueChange={(value) => setPreferences({ ...preferences, regionProfile: value as Preferences["regionProfile"] })}>
              <SelectTrigger className="mt-2 w-full" aria-label="Deployment requirements profile"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(regions).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <div className="flex items-center gap-3 md:col-span-2"><Button onClick={save} className="bg-teal-700 hover:bg-teal-800">Save preferences</Button><span className="text-sm text-slate-500" aria-live="polite">{status}</span></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-teal-700" />Deployment and compliance boundary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-slate-600"><p>Profiles record customer requirements; they do not certify compliance. The current hosted product provides authenticated access, expiring shares, and access logs.</p><p>Data residency, DPDP/GDPR operating processes, a US HIPAA BAA, and private-VPC/on-prem deployment require separate infrastructure and contracts before they can be claimed.</p></CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-teal-700" />Current plan</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-slate-600">
          <p>You are on the <strong className="capitalize text-slate-900">{plan ?? "…"}</strong> plan{quota && quota.limit !== null ? <> · {quota.used} of {quota.limit} report uploads used this month</> : null}.</p>
          {plan && plan !== "free" ? (
            <p>Manage payment methods, invoices, and cancellation in Stripe’s customer portal, or compare plans.</p>
          ) : (
            <p>Free includes 3 report uploads a month. Pro and Lab unlock trends, sharing, medications, and triage.</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1"><Button asChild className="bg-teal-700 hover:bg-teal-800"><Link href="/pricing">Compare plans</Link></Button></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-teal-700" />Billing</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-slate-600">Manage payment methods, invoices, and subscription cancellation in Stripe’s customer portal.</p><Button variant="outline" onClick={manageBilling}>Manage billing</Button></CardContent></Card>

        <Card className="border-rose-200"><CardHeader><CardTitle className="flex items-center gap-2 text-rose-700"><LogOut className="h-5 w-5" />Sign out</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-slate-600">End this signed-in session on this device.</p><Button
          onClick={() => { setSigningOut(true); void signOut({ redirectUrl: "/login" }); }}
          disabled={signingOut}
          className="bg-rose-600 font-semibold text-white hover:bg-rose-700"
        ><LogOut className="mr-2 h-4 w-4" aria-hidden="true" />{signingOut ? "Signing out…" : "Log out"}</Button></CardContent></Card>
      </div>
    </main>
  );
}
