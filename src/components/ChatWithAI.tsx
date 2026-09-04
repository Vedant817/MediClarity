"use client";
import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { v4 as uuidv4 } from "uuid";

type Props = {
    summary: string;
    ocr: string | undefined;
};

export default function ChatWithAI({ summary, ocr }: Props) {
    const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);
    const sessionIdRef = useRef<string>("");

    useEffect(() => {
        let cancelled = false;
        setSessionReady(false);
        const loadHistory = async () => {
            const content = new TextEncoder().encode(`${summary}\n${ocr ?? ""}`);
            const digest = await window.crypto.subtle.digest("SHA-256", content);
            const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
                byte.toString(16).padStart(2, "0")
            ).join("");
            const storageKey = `mediclarity-report-chat-${fingerprint}`;
            const existingSessionId = window.localStorage.getItem(storageKey);
            sessionIdRef.current = existingSessionId || uuidv4();
            if (!existingSessionId) {
                window.localStorage.setItem(storageKey, sessionIdRef.current);
            }

            const response = await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionIdRef.current)}`);
            const data = response.ok ? await response.json() : { messages: [] };
            if (!cancelled) {
                const persistedMessages = Array.isArray(data.messages)
                    ? data.messages.filter((message: { role?: string; content?: string }) =>
                        (message.role === "user" || message.role === "assistant") && typeof message.content === "string"
                    )
                    : [];
                setChatHistory(persistedMessages);
                setSessionReady(true);
            }
        };
        loadHistory().catch((error) => console.error("Failed to load report chat history:", error));
        return () => { cancelled = true; };
    }, [summary, ocr]);

    const sendMessage = async () => {
        if (!input.trim() || !sessionReady) return;

        const newHistory: { role: "user" | "assistant"; content: string }[] = [...chatHistory, { role: "user", content: input }];
        setChatHistory(newHistory);
        setLoading(true);

        const ocrText = ocr ?? "";

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sessionIdRef.current,
                    summary,
                    ocr: ocrText,
                    messages: newHistory,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                console.error("Report chat failed:", data.error);
            } else {
                setChatHistory([...newHistory, { role: "assistant", content: data.reply }]);
                setInput("");
            }
        } catch (error) {
            console.error("Report chat failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !loading && input.trim()) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="mt-4 rounded-md border bg-white p-4 shadow">
            <h2 className="text-lg font-bold mb-2">Ask about your report</h2>
            <div className="h-64 overflow-y-auto space-y-3 p-2 bg-gray-50 border rounded">
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
                        <div className={`inline-block p-2 rounded ${msg.role === "user" ? "bg-green-200" : "bg-gray-200"}`}>
                            <Markdown>{msg.content}</Markdown>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex gap-2 mt-4">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about your summary..."
                />
                <Button onClick={sendMessage} disabled={loading || !sessionReady || !input.trim()} className="bg-green-600 hover:bg-green-700">
                    {loading ? "Sending..." : "Send"}
                </Button>
            </div>
        </div>
    );
}
