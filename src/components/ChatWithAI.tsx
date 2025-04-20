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
    const sessionIdRef = useRef<string>("");

    useEffect(() => {
        sessionIdRef.current = uuidv4();
    }, []);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const newHistory: { role: "user" | "assistant"; content: string }[] = [...chatHistory, { role: "user", content: input }];
        setChatHistory(newHistory);
        setLoading(true);

        const ocrText = ocr ?? "";

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
        setChatHistory([...newHistory, { role: "assistant", content: data.reply }]);
        setInput("");
        setLoading(false);
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
                        <div className={`inline-block p-2 rounded ${msg.role === "user" ? "bg-blue-200" : "bg-gray-200"}`}>
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
                <Button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
                    {loading ? "Sending..." : "Send"}
                </Button>
            </div>
        </div>
    );
}
