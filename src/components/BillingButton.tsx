"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BillingButton({ plan, children }: { plan: "pro" | "lab"; children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (response.status === 401) {
        window.location.assign(`/login?redirect_url=${encodeURIComponent("/#pricing")}`);
        return;
      }
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Checkout could not start");
      window.location.assign(payload.url);
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Checkout could not start");
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="w-full bg-[#0b766e] text-white hover:bg-[#075e58] focus-visible:ring-[#ff735c]/50"
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {loading ? "Opening secure checkout…" : children}
      </Button>
      {error && <p className="mt-2 text-xs text-[#a13b2d]" role="alert">{error}</p>}
    </div>
  );
}
