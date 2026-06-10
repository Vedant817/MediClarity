"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui/button";

interface TextToSpeechButtonProps {
    text: string;
    lang?: string;
}

const languageAliases: Record<string, string> = {
    english: "en",
    hindi: "hi",
    spanish: "es",
    french: "fr",
    german: "de",
    tamil: "ta",
    telugu: "te",
    bengali: "bn",
    marathi: "mr",
    gujarati: "gu",
};

function resolveLanguageCode(lang?: string) {
    if (!lang) return "en";

    const normalized = lang.trim().toLowerCase();
    return languageAliases[normalized] ?? (normalized.slice(0, 2) || "en");
}

const TextToSpeechButton = ({ text, lang }: TextToSpeechButtonProps) => {
    const [speaking, setSpeaking] = useState(false);
    const languageCode = useMemo(() => resolveLanguageCode(lang), [lang]);

    const handleSpeak = () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            alert("Sorry, your browser does not support text to speech.");
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        utterance.lang = languageCode;
        utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith(languageCode)) ?? null;
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);

        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    const handleCancel = () => {
        window.speechSynthesis.cancel();
        setSpeaking(false);
    };

    return (
        <div className="flex flex-col gap-2 w-full text-white">
            <Button onClick={handleSpeak} variant="outline" className="w-full bg-green-500 hover:bg-green-600 cursor-pointer">
                🔊 {speaking ? "Speaking..." : "Read Aloud"}
            </Button>
            {speaking && (
                <Button onClick={handleCancel} variant="destructive" className="w-full bg-red-600 hover:bg-red-700 cursor-pointer">
                    🛑 Stop
                </Button>
            )}
        </div>
    );
};

export default TextToSpeechButton;
