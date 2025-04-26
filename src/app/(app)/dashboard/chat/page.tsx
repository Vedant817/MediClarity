"use client";
import React, { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, LoaderCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import clsx from "clsx";
import { useUser } from "@clerk/nextjs";
import Markdown from "react-markdown";

type Message = {
    role: "user" | "assistant";
    content: string;
};

const AIChatPage = () => {
    const { user } = useUser();
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [summary, setSummary] = useState<string>("");
    const [ocr, setOcr] = useState<string>("");
    const [isLoadingData, setIsLoadingData] = useState(true);
    const sessionIdRef = useRef<string>("");
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        sessionIdRef.current = uuidv4();
        fetchSummaryAndOcr();

        return () => {
            endSession();
        };
    }, []);

    const fetchSummaryAndOcr = async () => {
        if (!user) return;

        try {
            const res = await fetch(`/api/user-data?userId=${user.id}`);
            const data = await res.json();
            setSummary(data.summary || "");
            setOcr(data.ocr || "");
        } catch (error) {
            console.error("Failed to fetch summary and OCR:", error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || !user || isLoadingData) return;

        const userMessage: Message = { role: "user", content: input };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput("");
        setIsThinking(true);

        try {
            const res = await fetch("/api/chatbot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sessionIdRef.current,
                    userId: user.id,
                    summary,
                    ocr,
                    messages: updatedMessages,
                }),
            });

            const data = await res.json();
            const assistantMessage: Message = {
                role: "assistant",
                content: data.reply,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "❌ Something went wrong. Please try again." },
            ]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey && input.trim()) {
            e.preventDefault();
            sendMessage();
        }
    };

    const endSession = async () => {
        if (!sessionIdRef.current) return;

        try {
            await fetch("/api/chatbot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sessionIdRef.current,
                    endSession: true,
                }),
            });
            console.log("Session ended and memory cleared ✅");
        } catch (error) {
            console.error("Failed to end session:", error);
        }
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isThinking]);

    if (isLoadingData) {
        return (
            <div className="flex items-center justify-center h-screen">
                <LoaderCircle className="w-8 h-8 animate-spin text-teal-600" />
                <span className="ml-2 text-teal-800">Loading your data...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full">
            <div className="flex-grow overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <div className="container mx-auto px-4 py-6 space-y-4">
                        <h1 className="text-2xl font-bold mb-4">💬 AI Medical Assistant</h1>

                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={clsx(
                                    "max-w-md px-4 py-2 rounded-lg whitespace-pre-wrap",
                                    msg.role === "user"
                                        ? "ml-auto bg-teal-100 text-teal-900"
                                        : "mr-auto bg-gray-100 text-gray-800"
                                )}
                            >
                                <Markdown>{msg.content}</Markdown>
                            </div>
                        ))}

                        {isThinking && (
                            <div className="mr-auto text-gray-600 text-sm flex items-center gap-2 animate-pulse">
                                <LoaderCircle className="w-4 h-4 animate-spin" />
                                Thinking...
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>
                </ScrollArea>
            </div>

            <div className="border-t p-4 bg-white shadow-sm">
                <div className="container mx-auto flex gap-2">
                    <Input
                        placeholder="Ask about your medical report..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-grow"
                        disabled={isThinking}
                    />
                    <Button onClick={sendMessage} disabled={isThinking || !input.trim()} className="bg-teal-700">
                        {isThinking ? (
                            <LoaderCircle className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AIChatPage;
