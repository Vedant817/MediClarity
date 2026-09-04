"use client";
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';

interface TextToSpeechButtonProps {
    text: string;
    lang?: string;
}

const useTextToSpeech = () => {
    const [speaking, setSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            setSupported(true);
            const handleVoicesChanged = () => {
                setVoices(window.speechSynthesis.getVoices());
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

    const speak = ({ text, voice }: { text: string; voice: SpeechSynthesisVoice | undefined }) => {
        if (!supported) return;
        const utterance = new SpeechSynthesisUtterance(text);
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

    return { speak, cancel, speaking, supported, voices };
};


const TextToSpeechButton = ({ text, lang }: TextToSpeechButtonProps) => {
    const { speak, cancel, speaking, supported, voices } = useTextToSpeech();

    const handleSpeak = () => {
        if (speaking) {
            cancel();
            return;
        }
        if (supported) {
            const voice = voices.find((v) => v.lang.startsWith(lang || 'en'));
            speak({ text, voice });
        } else {
            alert('Sorry, your browser does not support text to speech.');
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full text-white">
            <Button onClick={handleSpeak} variant="outline" className='w-full bg-green-500 hover:bg-green-600 hover:text-white cursor-pointer'>
                🔊 {speaking ? 'Stop' : 'Read Aloud'}
            </Button>
        </div>
    )
}

export default TextToSpeechButton;