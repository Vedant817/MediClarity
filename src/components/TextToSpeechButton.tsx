"use client";
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { stripMarkdownForSpeech } from '@/lib/summary-excerpt';

interface TextToSpeechButtonProps {
    text: string;
    lang?: string;
}

const useTextToSpeech = () => {
    const [speaking, setSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [voicesReady, setVoicesReady] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            setSupported(true);
            const handleVoicesChanged = () => {
                const loaded = window.speechSynthesis.getVoices();
                setVoices(loaded);
                if (loaded.length > 0) setVoicesReady(true);
            };
            window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
            handleVoicesChanged(); // Initial load

            // Cleanup
            return () => {
                window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                window.speechSynthesis.cancel();
            };
        }
    }, []);

    const speak = ({ text, voice, lang }: { text: string; voice: SpeechSynthesisVoice | undefined; lang: string }) => {
        if (!supported) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        if (voice) {
            utterance.voice = voice;
        }
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => {
            console.error('SpeechSynthesis Error');
            setSpeaking(false);
        };
        window.speechSynthesis.speak(utterance);
    };

    const cancel = () => {
        if (!supported) return;
        window.speechSynthesis.cancel();
        setSpeaking(false);
    };

    return { speak, cancel, speaking, supported, voices, voicesReady };
};

/**
 * Read-aloud button with explicit state colors and per-language support.
 * - Idle: teal. Speaking: red (press again to stop).
 * - If the browser/OS has no voice for the requested language once voices
 *   have loaded, the button disables with an explanation instead of
 *   reading aloud in the wrong language. Browser speech synthesis is a
 *   free, keyless, on-device capability; there is no free-tier cloud TTS
 *   with a ToS-safe keyless API, so unsupported languages stay disabled.
 */
const TextToSpeechButton = ({ text, lang }: TextToSpeechButtonProps) => {
    const { speak, cancel, speaking, supported, voices, voicesReady } = useTextToSpeech();
    const targetLang = lang || 'en';
    const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.toLowerCase()));
    const unavailable = supported && voicesReady && !matchedVoice;

    const handleSpeak = () => {
        if (speaking) {
            cancel();
            return;
        }
        if (supported && !unavailable) {
            // Speak plain sentences, never raw markdown: table separators
            // like `|---|---|` would otherwise be read as "dash dash dash".
            speak({ text: stripMarkdownForSpeech(text), voice: matchedVoice, lang: targetLang });
        } else if (!supported) {
            alert('Sorry, your browser does not support text to speech.');
        }
    };

    if (unavailable) {
        return (
            <div className="flex flex-col gap-2 w-full">
                <Button
                    disabled
                    aria-disabled="true"
                    title={`No ${targetLang} voice is installed in this browser or OS, so read-aloud is unavailable for this language.`}
                    className="w-full cursor-not-allowed bg-slate-200 text-slate-500"
                >
                    🔊 Read Aloud unavailable ({targetLang})
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 w-full text-white">
            <Button
                onClick={handleSpeak}
                variant={speaking ? "destructive" : "default"}
                aria-pressed={speaking}
                aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
                title={speaking ? "Stop reading aloud" : "Read aloud"}
                className={`w-full cursor-pointer text-white ${speaking ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"}`}
            >
                {speaking ? '⏹ Stop' : '🔊 Read Aloud'}
            </Button>
        </div>
    )
}

export default TextToSpeechButton;
