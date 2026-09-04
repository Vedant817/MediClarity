import Link from "next/link";
import { ArrowRight, Check, CircleDashed, FileJson2, FileText, FlaskConical, Globe2, LineChart, ScanLine, Share2, ShieldCheck } from "lucide-react";
import { BillingButton } from "@/components/BillingButton";
import { Button } from "@/components/ui/button";
import { formatUsd, PRODUCT_CATALOG } from "@/config/product";

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

const plans = [
  { name: PRODUCT_CATALOG.free.name, price: formatUsd(PRODUCT_CATALOG.free.monthlyPriceCents), suffix: "forever", description: "Understand an occasional report.", features: [`${PRODUCT_CATALOG.free.maxReportsPerMonth} reports each month`, "Patient-friendly summary", "Report Q&A"], action: "free" as const },
  { name: PRODUCT_CATALOG.pro.name, price: formatUsd(PRODUCT_CATALOG.pro.monthlyPriceCents), suffix: "per month", description: "Build a longitudinal health record.", features: ["Unlimited reports", "Trends and normalized results", "Share, medications, and education"], action: "pro" as const },
  { name: PRODUCT_CATALOG.lab.name, price: formatUsd(PRODUCT_CATALOG.lab.monthlyPriceCents), suffix: "per month", description: "Structure reports for your product or lab.", features: ["API keys and usage dashboard", "Lab rows and FHIR output", `${formatUsd(PRODUCT_CATALOG.lab.usagePriceCents)} per processed report`], action: "lab" as const },
];

const comingSoon = ["Wearable integrations", "Predictive analytics", "E-prescribing", "Custom telehealth video", "Emergency response"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f3e9] text-[#102c2a] selection:bg-[#ff735c]/30">
      <header className="sticky top-0 z-50 border-b border-[#102c2a]/15 bg-[#f7f3e9]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="MediClarity home">
            <span className="grid size-8 place-items-center rounded-full bg-[#0b766e] text-[#f7f3e9]"><ScanLine className="size-4" aria-hidden="true" /></span>
            MediClarity
          </Link>
          <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Main navigation">
            <Link href="#product" className="hover:text-[#0b766e]">Product</Link>
            <Link href="#pricing" className="hover:text-[#0b766e]">Pricing</Link>
            <Link href="#boundaries" className="hover:text-[#0b766e]">Boundaries</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link href="/login">Log in</Link></Button>
            <Button asChild className="bg-[#102c2a] text-[#f7f3e9] hover:bg-[#0b766e]"><Link href="/signup">Upload a report <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
        </div>
      </header>

      <section className="border-b border-[#102c2a]/15">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div className="self-center">
            <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#0b766e]">Documents in. Comparable health data out.</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Your lab history should not be trapped in PDFs.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#36514e]">MediClarity turns lab reports and phone photos from different countries into structured results you can understand, compare, and share. Every result stays connected to its source document.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="bg-[#0b766e] text-white hover:bg-[#075e58]"><Link href="/signup">Start with 3 free reports <ArrowRight aria-hidden="true" /></Link></Button>
              <Button size="lg" variant="outline" asChild className="border-[#102c2a]/30 bg-transparent"><Link href="#product">See the data pipeline</Link></Button>
            </div>
            <div className="mt-7 flex max-w-xl items-start gap-3 border-l-2 border-[#ff735c] pl-4 text-sm leading-6 text-[#526864]">
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
              <div><p className="font-mono text-[10px] uppercase text-[#9fc8bf]">Flag</p><p className="text-sm text-[#ff9b88]">Source range</p></div>
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

      <section className="border-y border-[#102c2a]/15 bg-[#dcece7]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-3 lg:px-8">
          <div><p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">Available foundation</p><h3 className="mt-3 text-2xl font-semibold">Upload, OCR, explain, translate, ask, revisit.</h3></div>
          <div><p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">Built for provenance</p><h3 className="mt-3 text-2xl font-semibold">Results keep their report, date, unit, range, and source.</h3></div>
          <div><p className="font-mono text-xs uppercase tracking-widest text-[#0b766e]">Deployment direction</p><h3 className="mt-3 text-2xl font-semibold">Hosted open-weight models now; private deployment path later.</h3></div>
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
          <div><p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#9fc8bf]">Coming soon—not active product capabilities</p><div className="grid gap-3 sm:grid-cols-2">{comingSoon.map((item) => <div key={item} className="flex items-center gap-3 rounded-lg border border-[#f7f3e9]/15 px-4 py-3 text-sm"><CircleDashed className="size-4 text-[#ff9b88]" aria-hidden="true" />{item}</div>)}</div></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="rounded-2xl bg-[#ff735c] p-8 text-[#102c2a] md:flex md:items-end md:justify-between md:p-12">
          <div className="max-w-2xl"><p className="font-mono text-xs font-semibold uppercase tracking-widest">Start with the source</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Bring the report you already have.</h2><p className="mt-4 leading-7">Upload a PDF or photo. Keep the original beside every explanation and structured result.</p></div>
          <Button size="lg" asChild className="mt-7 bg-[#102c2a] text-[#f7f3e9] hover:bg-[#0b766e] md:mt-0"><Link href="/signup">Upload a report <ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-[#102c2a]/15"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#526864] sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>© {new Date().getFullYear()} MediClarity. Information only, not medical advice.</p><div className="flex gap-5"><Link href="/privacy" className="hover:text-[#0b766e]">Privacy</Link><Link href="/terms" className="hover:text-[#0b766e]">Terms</Link><Link href="/contact" className="hover:text-[#0b766e]">Contact</Link></div></div></footer>
    </main>
  );
}
