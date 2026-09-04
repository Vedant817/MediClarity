"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";

type Card = { _id: string; title: string; summary: string; locale: string; createdAt: string };

export default function LearnPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [message, setMessage] = useState("Loading report topics…");
  useEffect(() => {
    fetch("/api/education").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Topics could not be loaded");
      setCards(data.cards); setMessage("");
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="border-l-4 border-teal-600 pl-5"><p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">From your reports</p><h1 className="mt-2 text-3xl font-semibold">Topics to understand before your visit</h1><p className="mt-2 text-slate-600">Short, general explanations linked to findings present in your reports.</p></header>
      {message && <p className="border border-slate-200 bg-white p-8 text-center text-slate-500">{message}</p>}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{cards.map((card) => <article key={card._id} className="border border-slate-200 bg-white p-5 shadow-sm"><BookOpen className="h-5 w-5 text-teal-700" /><h2 className="mt-6 text-lg font-semibold">{card.title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{card.summary}</p><p className="mt-5 font-mono text-[10px] uppercase text-slate-400">{card.locale} · report-linked</p></article>)}</section>
      <p className="text-xs text-slate-500">For information only, not medical advice. These cards do not diagnose a condition.</p>
    </main>
  );
}
