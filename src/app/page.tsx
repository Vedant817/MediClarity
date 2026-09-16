import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck, Check, CircleDashed, FileJson2, FileText, FlaskConical, Globe2, KeyRound, Languages, Layers, LineChart, MessageCircle, Mic, Pill, ScanLine, Share2, ShieldCheck, Stethoscope } from "lucide-react";
import { BillingButton } from "@/components/BillingButton";
import { Button } from "@/components/ui/button";
import { getPlanDisplay } from "@/config/pricing-display";

const pipeline = [
  { label: "Source", value: "CBC-report.pdf", note: "original retained", icon: FileText },
  { label: "Extract", value: "10 lab rows", note: "source-linked", icon: ScanLine },
  { label: "Normalize", value: "HGB → Hemoglobin", note: "LOINC 718-7", icon: FileJson2 },
  { label: "Use", value: "Trend · share · API", note: "one health timeline", icon: LineChart },
];

const productLayers = [
  { title: "Structure the document", description: "Turn PDFs and phone photos into typed lab rows with the original report attached as provenance.", icon: FileJson2 },
  { title: "Compare across borders", description: "Map aliases, units, dates, and reference ranges so results from different labs can share a timeline.", icon: Globe2 },
  { title: "Share without an EHR", description: "Give family or a doctor a time-limited report view with an access trail—designed for messaging-first care.", icon: Share2 },
  { title: "Use the same pipeline by API", description: "Labs and clinics send a document and receive normalized rows plus standards-ready observations.", icon: FlaskConical },
];

type FeatureTier = "free" | "pro" | "lab";

const tierBadge: Record<FeatureTier, { label: string; className: string }> = {
  free: { label: "Included free", className: "border-[#0b766e]/40 text-[#0b766e]" },
  pro: { label: "Pro", className: "border-[#102c2a]/40 bg-[#102c2a] text-[#f7f3e9]" },
  lab: { label: "Lab plan", className: "border-[#0b766e] bg-[#0b766e] text-white" },
};

type Feature = { title: string; description: string; icon: typeof FileText; tier: FeatureTier };

const featureGroups: { kicker: string; heading: string; blurb: string; features: Feature[] }[] = [
  {
    kicker: "Your record",
    heading: "Reports become a record you can use.",
    blurb: "Everything extracted stays linked to its source document, so you can always check where a number came from.",
    features: [
      { title: "Structured lab results", description: "Uploads become typed rows—test, value, unit, reference range, flag—mapped to standard LOINC codes.", icon: FileJson2, tier: "free" },
      { title: "Lab trends", description: "Watch Hemoglobin or LDL across reports and labs, plotted against each test's own reference range.", icon: LineChart, tier: "pro" },
      { title: "3D Explain", description: "See which organ your abnormal results point to in interactive 3D—healthy vs affected, red-flag signs, Hindi and simple-language options.", icon: Layers, tier: "pro" },
      { title: "Record chat", description: "Ask questions answered only from your own reports and labs—with honest “not in your record” answers, never guesses.", icon: MessageCircle, tier: "free" },
      { title: "Translation + read-aloud", description: "Patient-friendly summaries in 7 languages, with speech playback for low-literacy access.", icon: Languages, tier: "free" },
    ],
  },
  {
    kicker: "Care",
    heading: "Guidance that points to a clinician.",
    blurb: "Triage and education that explain what to do next—without ever pretending to diagnose.",
    features: [
      { title: "Voice assistant", description: "Talk through your record hands-free in 10 Indian languages, with a live transcript and typed fallback.", icon: Mic, tier: "free" },
      { title: "Medications", description: "Medicines pulled from your reports plus your own entries, linked to their source report, with pharmacist-review flags on risky combinations.", icon: Pill, tier: "pro" },
      { title: "Care direction", description: "Describe symptoms for urgency guidance—how soon to seek care, which specialist fits, and red flags that mean act now.", icon: Stethoscope, tier: "pro" },
      { title: "Appointments", description: "Book real slots with available providers, get reminders, and record attended outcomes on your timeline.", icon: CalendarCheck, tier: "free" },
      { title: "Learn", description: "Short, simple-language explainers generated from your own abnormal results.", icon: BookOpen, tier: "pro" },
    ],
  },
  {
    kicker: "Share & build",
    heading: "Take the record to your doctor—or your product.",
    blurb: "Messaging-first sharing for families, and the same structuring pipeline as an API for labs.",
    features: [
      { title: "Share without an EHR", description: "Expiring links a doctor can open incognito, shareable over WhatsApp—plus a printable doctor summary, FHIR export, and a full access trail.", icon: Share2, tier: "pro" },
      { title: "Lab API + white-label", description: "Send a document, get normalized lab rows plus FHIR observations over one keyed endpoint. Brand the portal as your lab.", icon: KeyRound, tier: "lab" },
    ],
  },
];

const plans = getPlanDisplay();

const comingSoon = ["Wearable integrations", "Predictive analytics", "E-prescribing", "Custom telehealth video", "Emergency response"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f3e9] text-[#102c2a] selection:bg-[#0b766e]/25">
      <a href="#main-content" className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:not-sr-only focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[#102c2a] focus:shadow-lg">
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 border-b border-[#102c2a]/15 bg-[#f7f3e9]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="MediClarity home">
            <span className="grid size-8 place-items-center rounded-full bg-[#0b766e] text-[#f7f3e9]"><ScanLine className="size-4" aria-hidden="true" /></span>
            MediClarity
          </Link>
          <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Main navigation">
            <Link href="#product" className="hover:text-[#0b766e]">Product</Link>
            <Link href="#features" className="hover:text-[#0b766e]">Features</Link>
            <Link href="#pricing" className="hover:text-[#0b766e]">Pricing</Link>
            <Link href="#boundaries" className="hover:text-[#0b766e]">Boundaries</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link href="/login">Log in</Link></Button>
            <Button asChild className="bg-[#102c2a] text-[#f7f3e9] hover:bg-[#0b766e]">
              <Link href="/signup">
                <span className="sm:hidden">Upload</span>
                <span className="hidden sm:inline">Upload a report</span>
                <ArrowRight className="hidden sm:block" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section id="main-content" className="border-b border-[#102c2a]/15">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div className="self-center">
            <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0b766e]">Documents in. Comparable health data out.</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Your lab history should not be trapped in PDFs.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#36514e]">MediClarity turns lab reports and phone photos from different countries into structured results you can understand, compare, and share. Every result stays connected to its source document.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="bg-[#0b766e] text-white hover:bg-[#075e58]"><Link href="/signup">Start with 3 free reports <ArrowRight aria-hidden="true" /></Link></Button>
              <Button size="lg" variant="outline" asChild className="border-[#102c2a]/30 bg-transparent"><Link href="#product">See the data pipeline</Link></Button>
            </div>
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {[
                ["9", "illustrated organs in 3D Explain"],
                ["10", "voice-assistant languages"],
                ["7", "summary translation languages"],
                ["LOINC", "standard codes on lab rows"],
              ].map(([value, label]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-semibold tracking-tight text-[#102c2a]">{value}</dd>
                  <dd className="max-w-28 text-xs leading-4 text-[#526864]">{label}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 flex max-w-xl items-start gap-3 border-l-2 border-[#0b766e] pl-4 text-sm leading-6 text-[#526864]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0b766e]" aria-hidden="true" />
              <p>For information only, not medical advice or diagnosis. Always discuss results and urgent symptoms with a qualified clinician.</p>
            </div>
          </div>

          <div className="self-center overflow-hidden rounded-2xl border border-[#102c2a]/20 bg-[#fffdf7] shadow-[12px_12px_0_#c7ddd6]">
            <div className="flex items-center justify-between border-b border-[#102c2a]/15 px-5 py-4 font-mono text-xs uppercase tracking-widest"><span>Result provenance</span><span className="text-[#0b766e]">Traceable pipeline</span></div>
            <div className="divide-y divide-[#102c2a]/10">
              {pipeline.map((item, index) => (
                <div key={item.label} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-5">
                  <span className="grid size-10 place-items-center rounded-full border border-[#0b766e]/30 bg-[#dcece7] text-[#0b766e]"><item.icon className="size-5" aria-hidden="true" /></span>
                  <div><p className="font-mono text-[11px] uppercase tracking-wider text-[#687c78]">{index + 1}. {item.label}</p><p className="font-semibold">{item.value}</p></div>
                  <span className="hidden rounded-full bg-[#f7f3e9] px-3 py-1 font-mono text-[10px] text-[#526864] sm:block">{item.note}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 border-t border-[#102c2a]/15 bg-[#102c2a] px-5 py-4 text-[#f7f3e9]">
              <div><p className="font-mono text-[10px] uppercase text-[#9fc8bf]">Test</p><p className="text-sm">Hemoglobin</p></div>
              <div><p className="font-mono text-[10px] uppercase text-[#9fc8bf]">Value</p><p className="text-sm">13.2 g/dL</p></div>
              <div><p className="font-mono text-[10px] uppercase text-[#9fc8bf]">Flag</p><p className="text-sm text-[#5eead4]">Source range</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr]">
          <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0b766e]">The product wedge</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">One structuring layer, four ways to use it.</h2><p className="mt-5 leading-7 text-[#526864]">The report explainer is the entry point. Structured, source-linked lab data is the product.</p></div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-[#102c2a]/15 bg-[#102c2a]/15 sm:grid-cols-2">
            {productLayers.map((feature) => <article key={feature.title} className="bg-[#fffdf7] p-7"><feature.icon className="size-6 text-[#0b766e]" aria-hidden="true" /><h3 className="mt-8 text-xl font-semibold">{feature.title}</h3><p className="mt-3 text-sm leading-6 text-[#526864]">{feature.description}</p></article>)}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8">
        <div className="max-w-2xl"><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0b766e]">Features</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Everything your reports can do once they are structured.</h2><p className="mt-4 leading-7 text-[#526864]">Badges show which plan each capability needs. Start free; upgrade when your record grows.</p></div>
        <div className="mt-12 space-y-14">
          {featureGroups.map((group) => (
            <div key={group.kicker}>
              <div className="max-w-2xl"><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0b766e]">{group.kicker}</p><h3 className="mt-2 text-2xl font-semibold tracking-tight">{group.heading}</h3><p className="mt-2 text-sm leading-6 text-[#526864]">{group.blurb}</p></div>
              <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[#102c2a]/15 bg-[#102c2a]/15 sm:grid-cols-2 lg:grid-cols-3">
                {group.features.map((feature) => (
                  <article key={feature.title} className="flex flex-col bg-[#fffdf7] p-7">
                    <div className="flex items-start justify-between gap-3">
                      <feature.icon className="size-6 shrink-0 text-[#0b766e]" aria-hidden="true" />
                      <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${tierBadge[feature.tier].className}`}>{tierBadge[feature.tier].label}</span>
                    </div>
                    <h4 className="mt-6 text-lg font-semibold">{feature.title}</h4>
                    <p className="mt-2 flex-1 text-sm leading-6 text-[#526864]">{feature.description}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#102c2a]/15 bg-[#dcece7]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-3 lg:px-8">
          <div><p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">Provenance over black boxes</p><h3 className="mt-3 text-2xl font-semibold">Every result links back to its source document.</h3><p className="mt-3 text-sm leading-6 text-[#36514e]">Summaries, lab rows, medications, and 3D explanations all carry their report, date, and range—so a doctor can verify, not just trust.</p></div>
          <div><p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">Cross-lab, cross-border by design</p><h3 className="mt-3 text-2xl font-semibold">Aliases, units, and ranges normalized to LOINC-coded rows.</h3><p className="mt-3 text-sm leading-6 text-[#36514e]">Results from different labs and countries share one timeline, each plotted against its own source reference range.</p></div>
          <div><p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">Messaging-first sharing</p><h3 className="mt-3 text-2xl font-semibold">Expiring links that work over WhatsApp—with an audit trail.</h3><p className="mt-3 text-sm leading-6 text-[#36514e]">No EHR login needed for family or a doctor. Open-weight models keep the pipeline portable toward private deployment.</p></div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="max-w-2xl"><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0b766e]">Launch pricing</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Pay for a longer record—or for the pipeline.</h2><p className="mt-4 text-[#526864]">Recurring plans are managed through Stripe. Usage billing for the Lab API begins when API access is enabled.</p></div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className={`flex flex-col rounded-2xl border p-7 ${plan.name === "Pro" ? "border-[#0b766e] bg-[#fffdf7] shadow-[7px_7px_0_#0b766e]" : "border-[#102c2a]/20 bg-[#fffdf7]"}`}>
              <p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">{plan.name}</p>
              <div className="mt-5 flex items-end gap-2"><span className="text-5xl font-semibold tracking-tight">{plan.price}</span><span className="pb-1 text-sm text-[#687c78]">{plan.suffix}</span></div>
              <p className="mt-4 text-sm text-[#526864]">{plan.description}</p>
              <ul className="my-7 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-[#0b766e]" aria-hidden="true" />{feature}</li>)}</ul>
              {plan.action === "free" ? <Button asChild variant="outline" className="w-full border-[#102c2a]/30"><Link href="/signup">Create free account</Link></Button> : <BillingButton plan={plan.action}>Choose {plan.name}</BillingButton>}
            </article>
          ))}
        </div>
      </section>

      <section id="boundaries" className="border-y border-[#102c2a]/15 bg-[#102c2a] text-[#f7f3e9]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#9fc8bf]">Deliberate boundaries</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Useful now. Careful about what comes next.</h2><p className="mt-5 max-w-lg leading-7 text-[#c7d8d4]">MediClarity does not diagnose, prescribe, replace emergency services, or claim regulatory certifications that have not been independently established.</p></div>
          <div><p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#9fc8bf]">Coming soon—not active product capabilities</p><div className="grid gap-3 sm:grid-cols-2">{comingSoon.map((item) => <div key={item} className="flex items-center gap-3 rounded-lg border border-[#f7f3e9]/15 px-4 py-3 text-sm"><CircleDashed className="size-4 text-[#5eead4]" aria-hidden="true" />{item}</div>)}</div></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="rounded-2xl bg-[#0b766e] p-8 text-[#f7f3e9] md:flex md:items-end md:justify-between md:p-12">
          <div className="max-w-2xl"><p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#9fc8bf]">Start with the source</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Bring the report you already have.</h2><p className="mt-4 leading-7 text-[#dcece7]">Upload a PDF or photo. Keep the original beside every explanation and structured result.</p></div>
          <Button size="lg" asChild className="mt-7 bg-[#f7f3e9] text-[#102c2a] hover:bg-white md:mt-0"><Link href="/signup">Upload a report <ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-[#102c2a]/15"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#526864] sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>© {new Date().getFullYear()} MediClarity. Information only, not medical advice.</p><div className="flex gap-5"><Link href="/privacy" className="hover:text-[#0b766e]">Privacy</Link><Link href="/terms" className="hover:text-[#0b766e]">Terms</Link><Link href="/contact" className="hover:text-[#0b766e]">Contact</Link></div></div></footer>
    </main>
  );
}
