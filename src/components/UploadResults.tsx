"use client";
import { useState } from "react";
import Markdown from "@/components/Markdown";
import ChatWithAI from "@/components/ChatWithAI";
import TextToSpeechButton from "@/components/TextToSpeechButton";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select"

export const languageOptions = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'pa', label: 'Punjabi' },
    { code: 'es', label: 'Spanish' },
    { code: 'ar', label: 'Arabic' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'fr', label: 'French' },
];

type UploadResultsProps = {
    summary: string;
    translatedSummary: string;
    selectedLang: string;
    onLanguageChange: (value: string) => void;
    ocrResult: string | null;
};

/**
 * Post-upload results (summary, translation, chat, read-aloud). Loaded
 * lazily via next/dynamic so the upload route itself stays light and
 * navigating to it feels instant even on a cold dev compile.
 */
export default function UploadResults({
    summary,
    translatedSummary,
    selectedLang,
    onLanguageChange,
    ocrResult,
}: UploadResultsProps) {
    const [showChat, setShowChat] = useState(false);

    return (
        <>
            <div className="space-y-4 p-4">
                <div className="space-y-2 rounded-md bg-yellow-50 p-3">
                    <p className="text-sm font-medium text-yellow-800">Summary:</p>
                    <pre className="whitespace-pre-wrap text-xs text-yellow-700">
                        <Markdown>{translatedSummary || summary}</Markdown>
                    </pre>
                </div>
                {!showChat && (
                    <div className="flex gap-2 w-full">
                        <Button
                            onClick={() => setShowChat(true)}
                            className="w-[50%] bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                        >
                            Have a chat with report
                        </Button>
                        <div className="w-full">
                            <TextToSpeechButton text={translatedSummary || summary} lang={selectedLang} />
                        </div>
                        <div className="flex w-full items-center gap-2">
                            <Select value={selectedLang} onValueChange={onLanguageChange} >
                                <SelectTrigger className="w-full" aria-label="Summary language">
                                    <SelectValue placeholder="Select a language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup className="w-full items-center justify-center">
                                        <SelectLabel>Languages</SelectLabel>
                                        {languageOptions.map((lang) => (
                                            <SelectItem key={lang.code} value={lang.code}>
                                                {lang.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>
            {showChat && summary && ocrResult && (
                <div className="p-4">
                    <ChatWithAI summary={summary} ocr={ocrResult} />
                </div>
            )}
        </>
    );
}
