'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createAppointment } from '@/actions/appointment';
import { BookingData, Doctor } from '@/types';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

function extractTaggedJson<T>(message: string, tag: 'SUGGESTED_DOCTORS' | 'BOOKING_READY'): T | null {
    const pattern = tag === 'SUGGESTED_DOCTORS'
        ? /SUGGESTED_DOCTORS\s*(\[[\s\S]*?\])/m
        : /BOOKING_READY\s*(\{[\s\S]*?\})/m;
    const jsonMatch = message.match(pattern);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[1]) as T;
        } catch (e) {
            console.error('Failed to parse JSON data:', e);
        }
    }
    return null;
}

export default function ConversationalScheduler() {
    const router = useRouter();
    const { user } = useUser();
    const [messages, setMessages] = useState<{ id: string; role: 'user' | 'assistant' | 'system'; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBookingReady, setIsBookingReady] = useState(false);
    const [bookingData, setBookingData] = useState<BookingData | null>(null);
    const [suggestedDoctors, setSuggestedDoctors] = useState<Doctor[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [providerCatalog, setProviderCatalog] = useState<Array<{ id: string; name: string; specialty: string }>>([]);
    const abortControllerRef = useRef<AbortController | null>(null);
    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);


    useEffect(() => {
        const loadConversationHistory = async (): Promise<void> => {
            if (!user?.id) return;

            try {
                const response = await fetch('/api/appointment/scheduler/history');
                const data = await response.json();

                if (data.messages && data.messages.length > 0) {
                    const formattedMessages = data.messages.map((msg: { timestamp: number; role: 'user' | 'assistant'; content: string }) => ({
                        id: `${msg.timestamp}-${msg.role}`,
                        role: msg.role,
                        content: msg.content
                    }));

                    setMessages(formattedMessages);
                    setConversationId(data.conversationId || null);
                }
            } catch (error) {
                console.error('Failed to load conversation history:', error);
            }
        };

        loadConversationHistory();
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        fetch('/api/providers')
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('Providers unavailable')))
            .then((data: { providers: Array<{ id: string; name: string; specialty: string }> }) => setProviderCatalog(data.providers))
            .catch(() => setProviderCatalog([]));
    }, [user?.id]);

    const clearChat = async () => {
        if (conversationId) {
            const response = await fetch(`/api/appointment/scheduler/history?conversationId=${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
            if (!response.ok) {
                toast.error('Saved conversation could not be cleared');
                return;
            }
        }
        setMessages([]);
        setIsBookingReady(false);
        setBookingData(null);
        setSuggestedDoctors([]);
        setConversationId(null);
    };

    const handleSubmit = useCallback(async (e: React.FormEvent, programmaticContent?: string) => {
        e.preventDefault();

        const contentToSubmit = programmaticContent || input;

        if (!user?.id || !contentToSubmit.trim()) return;

        const userMessage = {
            id: Date.now().toString(),
            role: 'user' as const,
            content: contentToSubmit,
        };

        setMessages(prev => [...prev, userMessage]);
        if (!programmaticContent) {
            setInput('');
        }

        setIsLoading(true);

        try {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            abortControllerRef.current = new AbortController();

            const response = await fetch('/api/appointment/scheduler', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: contentToSubmit }],
                    conversationId: conversationId
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.body) {
                throw new Error('No response body');
            }

            const newConversationId = response.headers.get('X-Conversation-ID');
            if (newConversationId) {
                setConversationId(newConversationId);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = {
                id: Date.now().toString(),
                role: 'assistant' as const,
                content: '',
            };

            setMessages(prev => [...prev, assistantMessage]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantMessage = {
                    ...assistantMessage,
                    content: assistantMessage.content + chunk,
                };

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = assistantMessage;
                    return newMessages;
                });
            }

            const finalContent = assistantMessage.content;

            if (finalContent.includes('SUGGESTED_DOCTORS')) {
                const doctors = extractTaggedJson<Doctor[]>(finalContent, 'SUGGESTED_DOCTORS');
                if (Array.isArray(doctors)) {
                    setSuggestedDoctors(doctors.filter((doctor) => providerCatalog.some((provider) =>
                        provider.id === doctor.id && provider.name === doctor.name && provider.specialty === doctor.specialty)));
                }
            }

            if (finalContent.includes('BOOKING_READY')) {
                const bookingInfo = extractTaggedJson<BookingData>(finalContent, 'BOOKING_READY');
                const provider = bookingInfo && providerCatalog.find((entry) => entry.id === bookingInfo.providerId && entry.name === bookingInfo.providerName);
                if (bookingInfo && provider) {
                    setBookingData(bookingInfo);
                    setIsBookingReady(true);
                }
            }

            const conversationalText = finalContent
                .replace(/SUGGESTED_DOCTORS[\s\S]*?]/, '')
                .replace(/BOOKING_READY[\s\S]*?}/, '')
                .trim();

            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { ...assistantMessage, content: conversationalText };
                return newMessages;
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('Error:', error);
            toast.error('Failed to get response from AI assistant');
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant' as const,
                content: 'Sorry, I encountered an error processing your request. Please try again.',
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [user, conversationId, input, providerCatalog]);

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
        }
    };

    const handleDoctorSelection = (doctorId: string) => {
        const selectedDoctor = suggestedDoctors.find(d => d.id === doctorId);
        if (selectedDoctor) {
            const userMessage = {
                id: Date.now().toString(),
                role: 'user' as const,
                content: `I'd like to schedule an appointment with Dr. ${selectedDoctor.name}.`,
            };
            setMessages(prev => [...prev, userMessage]);
        }
    };

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user' && lastMessage.content.startsWith("I'd like to schedule an appointment with Dr.")) {
            const formEvent = { preventDefault: () => {} } as React.FormEvent;
            handleSubmit(formEvent, lastMessage.content);
        }
    }, [messages, handleSubmit]);

    const handleFinalBooking = async () => {
        if (user && bookingData?.providerId && bookingData.date && bookingData.time && bookingData.reason && bookingData.appointmentType) {
            const formData = new FormData();
            formData.append('providerId', bookingData.providerId);
            formData.append('date', bookingData.date);
            formData.append('time', bookingData.time);
            formData.append('reason', bookingData.reason);
            formData.append('appointmentType', bookingData.appointmentType);

            const result = await createAppointment(null, formData);

            if (result.success) {
                toast.success("Appointment scheduled successfully!");
                router.push('/dashboard/appointments');
            } else {
                toast.error(`Failed to schedule appointment: ${result.error}`);
            }
        } else toast.error('The suggested booking is incomplete. Ask the scheduler for provider, type, date, time, and reason.');
    };

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col h-[calc(100vh-160px)] bg-white rounded-lg shadow-md">
            <div className="p-4 border-b">
                <h2 className="text-2xl font-bold text-center">MediClarity AI Scheduler</h2>
                <p className="text-sm text-gray-600 text-center">I can help you find the right doctor and book your next appointment.</p>
            </div>

            <div ref={chatContainerRef} className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50">
                {messages.filter(m => m.role !== 'system').map((m, i) => (
                    <div
                        key={i}
                        className={`flex-grow-0 p-3 rounded-lg max-w-[80%] ${m.role === 'user' ? 'bg-blue-500 text-white rounded-br-none ml-auto' : 'bg-gray-200 text-gray-800 rounded-bl-none mr-auto'}`}>
                        <Markdown>{m.content.replace(/BOOKING_READY|SUGGESTED_DOCTORS/g, '')}</Markdown>
                    </div>
                ))}
                {isLoading && (
                    <div className="bg-gray-200 rounded-lg p-3 animate-pulse mr-auto max-w-[80%]">
                        Thinking...
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-white">
                {suggestedDoctors.length > 0 && !isBookingReady && (
                    <Card className="mb-4">
                        <CardHeader>
                            <CardTitle>Suggested Doctors</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {suggestedDoctors.map((doctor: Doctor) => (
                                <div key={doctor.id} className="p-4 border rounded-lg">
                                    <h3 className="font-bold">{doctor.name}</h3>
                                    <p className="text-sm text-gray-600">{doctor.specialty}</p>
                                    <p className="text-sm mt-2">{doctor.justification}</p>
                                    <Button onClick={() => handleDoctorSelection(doctor.id)} className="mt-2">
                                        Select Dr. {doctor.name.split(' ').slice(1).join(' ')}
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {isBookingReady && bookingData && (
                    <Card className="mb-4 bg-green-50 border-green-200">
                        <CardHeader>
                            <CardTitle className="text-green-800">Confirm Your Appointment</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p><strong>Provider:</strong> {bookingData.providerName}</p>
                            <p><strong>Date:</strong> {bookingData.date}</p>
                            <p><strong>Time:</strong> {bookingData.time}</p>
                            <p><strong>Reason:</strong> {bookingData.reason}</p>
                            <Button onClick={handleFinalBooking} className="mt-4 w-full bg-green-600 hover:bg-green-700">
                                Schedule Appointment
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <div className="flex justify-between items-center mb-2">
                    <Button onClick={clearChat} variant="destructive" size="sm" className='bg-red-500 hover:bg-red-600 cursor-pointer' disabled={isLoading || !messages.length}>
                        Clear Chat
                    </Button>
                    {isLoading && (
                        <Button onClick={stopGeneration} variant="destructive" size="sm" className='bg-red-500 hover:bg-red-600 cursor-pointer'>
                            Stop Generation
                        </Button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                        aria-label="Appointment request"
                        className="flex-1 border rounded p-2"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe your symptoms or appointment needs..."
                        disabled={isLoading || isBookingReady}
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || !input.trim() || isBookingReady}
                        className="bg-teal-500 hover:bg-teal-600 text-white"
                    >
                        Send
                    </Button>
                </form>
            </div>
        </div>
    );
}
