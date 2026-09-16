"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Report caption with an opt-in Hindi translation. English renders
 * immediately; Hindi is fetched lazily once per caption and cached, so
 * reports that stay in English cost nothing. Failures fall back to
 * English with a note instead of breaking the view.
 */
export default function CaptionBlock({
  text,
  allowTranslate = false,
}: {
  text: string;
  allowTranslate?: boolean;
}) {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [failed, setFailed] = useState(false);

  const showHindi = async () => {
    setLang("hi");
    setFailed(false);
    if (translated !== null) return;
    setTranslating(true);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang: "hi" }),
      });
      const data = (await response.json().catch(() => ({}))) as { translatedText?: string };
      if (!response.ok || !data.translatedText) throw new Error("translation failed");
      setTranslated(data.translatedText);
    } catch {
      setFailed(true);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div>
      {allowTranslate && (
        <div className="mb-2 flex gap-1" role="group" aria-label="Caption language">
          {(["en", "hi"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => (option === "hi" ? void showHindi() : setLang("en"))}
              aria-pressed={lang === option}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                lang === option
                  ? "bg-teal-700 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option === "en" ? "English" : "हिंदी"}
            </button>
          ))}
        </div>
      )}
      {lang === "hi" ? (
        translating ? (
          <div className="space-y-2" role="status" aria-busy="true">
            <span className="sr-only">Translating caption…</span>
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-teal-700" aria-hidden="true" />
              <div className="h-3 flex-1 animate-pulse rounded bg-slate-200" aria-hidden="true" />
            </div>
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" aria-hidden="true" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200" aria-hidden="true" />
          </div>
        ) : translated ? (
          <p className="text-sm leading-6 text-slate-600" lang="hi">
            {translated}
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-600">{text}</p>
            {failed && (
              <p className="mt-1 text-xs text-slate-500">
                Hindi translation is unavailable right now — showing English.
              </p>
            )}
          </>
        )
      ) : (
        <p className="text-sm leading-6 text-slate-600">{text}</p>
      )}
    </div>
  );
}
