"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, LoaderCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import clsx from "clsx";
import { useUser } from "@clerk/nextjs";
import Markdown from "react-markdown";

interface RagSourceBadge {
    id: string;
    sourceType: string;
    score: number;
    chunkIndex?: number;
    reportId?: string;
}

type Message = {
    role: "user" | "assistant";
    content: string;
    confidence?: "high" | "medium" | "low";
    sources?: RagSourceBadge[];
};

const confidenceStyles = {
    high: "bg-green-50 text-green-700 border-green-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-red-50 text-red-700 border-red-200",
};

const AIChatPage = () => {
    const { user, isLoaded } = useUser();
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isSessionInitialized, setIsSessionInitialized] = useState(false);
    const [initializationError, setInitializationError] = useState<string | null>(null);
    const [contextStats, setContextStats] = useState<{ chunkCount?: number; reportId?: string }>({});

    const sessionIdRef = useRef<string>("");
    const bottomRef = useRef<HTMLDivElement>(null);

    const initializeSession = useCallback(async () => {
        if (!user) return;

        setIsThinking(true);
        setInitializationError(null);
        try {
            const res = await fetch("/api/chatbot/initialize-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sessionIdRef.current }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to initialize report context");
            }

            setContextStats({ chunkCount: data.chunkCount, reportId: data.reportId });
            setMessages([]);
            setIsSessionInitialized(true);
        } catch (error) {
            console.error("Session initialization error:", error);
            setInitializationError(error instanceof Error ? error.message : "Unable to prepare report context");
        } finally {
            setIsThinking(false);
        }
    }, [user]);

    const endSession = useCallback(async () => {
        if (!sessionIdRef.current) return;
        try {
            await fetch("/api/chatbot/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sessionIdRef.current, endSession: true }),
            });
        } catch (error) {
            console.error("Failed to end session:", error);
        }
    }, []);

    useEffect(() => {
        if (!isLoaded || !user) return;

        sessionIdRef.current = uuidv4();
        setIsSessionInitialized(false);
        initializeSession();

        return () => {
            endSession();
        };
    }, [isLoaded, user, initializeSession, endSession]);

    const sendMessage = async () => {
        if (!input.trim() || !user || !isSessionInitialized || isThinking) return;

        const question = input.trim();
        const userMessage: Message = { role: "user", content: question };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput("");
        setIsThinking(true);

        try {
            const res = await fetch("/api/chatbot/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sessionIdRef.current,
                    userMessage: question,
                    messages: updatedMessages,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.reply || "Chat request failed");

            const assistantMessage: Message = {
                role: "assistant",
                content: data.reply,
                confidence: data.confidence,
                sources: data.sources,
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

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isThinking]);

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center h-screen w-full">
                <LoaderCircle className="w-8 h-8 animate-spin text-teal-600" />
                <span className="ml-2">Loading your account...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full">
            <div className="flex-grow overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <div className="container mx-auto px-4 py-6 space-y-4">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold">💬 AI Medical Report Copilot</h1>
                            <p className="text-sm text-gray-500">
                                RAG-grounded answers with source IDs, confidence labels, and medical safety boundaries.
                            </p>
                            {isSessionInitialized && (
                                <p className="text-xs text-gray-500">
                                    Prepared {contextStats.chunkCount ?? 0} searchable report chunks for this session.
                                </p>
                            )}
                        </div>

                        {initializationError && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                <p className="font-semibold">Report context is not ready.</p>
                                <p>{initializationError}</p>
                                <Button className="mt-3" variant="outline" onClick={initializeSession} disabled={isThinking}>
                                    Retry context preparation
                                </Button>
                            </div>
                        )}

                        {messages.length === 0 && !initializationError && (
                            <div className="text-center text-gray-500 py-8">
                                <p>Ask about findings, abnormal values, follow-up instructions, or medical terms from your latest report.</p>
                                {!isSessionInitialized && (
                                    <div className="mt-2 flex items-center justify-center gap-2">
                                        <LoaderCircle className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">Preparing source-grounded medical context...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={clsx(
                                    "max-w-2xl px-4 py-3 rounded-lg whitespace-pre-wrap",
                                    msg.role === "user"
                                        ? "ml-auto bg-teal-100 text-teal-900"
                                        : "mr-auto bg-gray-100 text-gray-800"
                                )}
                            >
                                <Markdown>{msg.content}</Markdown>
                                {msg.role === "assistant" && msg.confidence && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                        <span className={clsx("rounded-full border px-2 py-1", confidenceStyles[msg.confidence])}>
                                            {msg.confidence.toUpperCase()} confidence
                                        </span>
                                        {msg.sources?.map((source) => (
                                            <span key={source.id} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-600">
                                                {source.id}: {source.sourceType}{typeof source.chunkIndex === "number" ? ` #${source.chunkIndex + 1}` : ""}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isThinking && (
                            <div className="mr-auto text-gray-600 text-sm flex items-center gap-2 animate-pulse">
                                <LoaderCircle className="w-4 h-4 animate-spin" />
                                Thinking with report retrieval...
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>
                </ScrollArea>
            </div>

            <div className="border-t p-4 bg-white shadow-sm">
                <div className="container mx-auto flex gap-2">
                    <Input
                        placeholder="Ask a source-grounded question about your medical report..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-grow"
                        disabled={isThinking || !isSessionInitialized}
                    />
                    <Button
                        onClick={sendMessage}
                        disabled={isThinking || !input.trim() || !isSessionInitialized}
                        className="bg-teal-700"
                    >
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
