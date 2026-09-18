'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createAppointment, rescheduleAppointment } from '@/actions/appointment';
import { BookingData, Doctor } from '@/types';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { extractSchedulerTaggedJson, extractSuggestedDoctors, stripSchedulerMetadata } from '@/lib/scheduler-context';

/**
 * Strip streaming artifacts from assistant text before rendering/saving:
 * leftover SUGGESTED_DOCTORS/BOOKING_READY tags, stray lines that contain
 * only markdown emphasis markers (rendered literally as "**"), and excess
 * blank lines. Lines with real content (including list items) are kept.
 */
function cleanAssistantText(content: string): string {
    return stripSchedulerMetadata(content)
        .split('\n')
        .filter((line) => !/^\s*\*{1,3}\s*$/.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export default function ConversationalScheduler() {
    const router = useRouter();
    const { user } = useUser();
    const [messages, setMessages] = useState<{ id: string; role: 'user' | 'assistant' | 'system'; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [isBookingReady, setIsBookingReady] = useState(false);
    const [isRescheduleReady, setIsRescheduleReady] = useState(false);
    const [bookingData, setBookingData] = useState<BookingData | null>(null);
    const [bookingIssue, setBookingIssue] = useState<{ messageId: string; content: string } | null>(null);
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

    useEffect(() => {
        if (providerCatalog.length === 0 || isLoading) return;
        const controller = new AbortController();
        const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
        if (!latestAssistant) {
            setSuggestedDoctors([]);
            setBookingData(null);
            setIsBookingReady(false);
            setIsRescheduleReady(false);
            setBookingIssue(null);
            return () => controller.abort();
        }

        const doctors = extractSuggestedDoctors(latestAssistant.content)
            .filter((doctor) => providerCatalog.some((provider) =>
                provider.id === doctor.id && provider.name === doctor.name && provider.specialty === doctor.specialty))
            .map((doctor) => ({ ...doctor, justification: doctor.justification ?? "" }));
        setSuggestedDoctors(doctors);

        const reschedule = extractSchedulerTaggedJson<BookingData>(latestAssistant.content, 'RESCHEDULE_READY');
        if (reschedule?.appointmentId && reschedule.providerId && reschedule.date && reschedule.time) {
            const provider = providerCatalog.find((entry) =>
                entry.id === reschedule.providerId && entry.name === reschedule.providerName) ?? providerCatalog.find((entry) => entry.id === reschedule.providerId);
            if (!provider) {
                setBookingData(null);
                setIsBookingReady(false);
                setIsRescheduleReady(false);
                setBookingIssue({
                    messageId: latestAssistant.id,
                    content: 'I could not validate that reschedule. No appointment was moved. Please ask for another listed time.',
                });
                return () => controller.abort();
            }
            fetch(`/api/availability?providerId=${encodeURIComponent(provider.id)}&date=${encodeURIComponent(reschedule.date)}&excludeAppointmentId=${encodeURIComponent(reschedule.appointmentId)}`, {
                signal: controller.signal,
                cache: 'no-store',
            })
                .then((response) => response.ok ? response.json() : Promise.reject(new Error('Availability validation failed')))
                .then((data: { availableTimes?: string[]; ownedScheduledTimes?: string[] }) => {
                    if (data.ownedScheduledTimes?.includes(reschedule.time!)) {
                        setBookingData(null);
                        setIsBookingReady(false);
                        setIsRescheduleReady(false);
                        setBookingIssue({
                            messageId: latestAssistant.id,
                            content: `You already have a visit with ${provider.name} on ${reschedule.date} at ${reschedule.time}. That slot cannot be used for a reschedule.`,
                        });
                        return;
                    }
                    if (!data.availableTimes?.includes(reschedule.time!)) {
                        setBookingData(null);
                        setIsBookingReady(false);
                        setIsRescheduleReady(false);
                        setBookingIssue({
                            messageId: latestAssistant.id,
                            content: `The proposed ${reschedule.time} slot on ${reschedule.date} is not available. No appointment was moved. Please ask for another listed time.`,
                        });
                        return;
                    }
                    setBookingData({ ...reschedule, providerName: provider.name, providerId: provider.id });
                    setIsRescheduleReady(true);
                    setIsBookingReady(false);
                    setBookingIssue(null);
                })
                .catch((error) => {
                    if (error instanceof Error && error.name === 'AbortError') return;
                    setBookingData(null);
                    setIsBookingReady(false);
                    setIsRescheduleReady(false);
                    setBookingIssue({
                        messageId: latestAssistant.id,
                        content: 'I could not verify that slot against live availability. No appointment was moved. Please try again.',
                    });
                });
            return () => controller.abort();
        }

        const booking = extractSchedulerTaggedJson<BookingData>(latestAssistant.content, 'BOOKING_READY');
        if (!booking) {
            setBookingData(null);
            setIsBookingReady(false);
            setIsRescheduleReady(false);
            setBookingIssue(null);
            return () => controller.abort();
        }

        const provider = booking && providerCatalog.find((entry) =>
            entry.id === booking.providerId && entry.name === booking.providerName);
        const complete = Boolean(
            provider && booking?.date && booking.time && booking.reason && booking.reason.length >= 10 && booking.appointmentType,
        );
        if (!complete || !provider || !booking.date || !booking.time) {
            setBookingData(null);
            setIsBookingReady(false);
            setIsRescheduleReady(false);
            setBookingIssue({
                messageId: latestAssistant.id,
                content: 'I could not validate all booking details. No appointment was booked. Please ask the scheduler for another provider and time.',
            });
            return () => controller.abort();
        }

        fetch(`/api/availability?providerId=${encodeURIComponent(provider.id)}&date=${encodeURIComponent(booking.date)}`, {
            signal: controller.signal,
            cache: 'no-store',
        })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('Availability validation failed')))
            .then((data: { availableTimes?: string[]; ownedScheduledTimes?: string[] }) => {
                if (data.ownedScheduledTimes?.includes(booking.time!)) {
                    setBookingData(null);
                    setIsBookingReady(false);
                    setIsRescheduleReady(false);
                    setBookingIssue({
                        messageId: latestAssistant.id,
                        content: `This appointment is scheduled with ${provider.name} on ${booking.date} at ${booking.time}.`,
                    });
                    return;
                }
                if (!data.availableTimes?.includes(booking.time!)) {
                    setBookingData(null);
                    setIsBookingReady(false);
                    setIsRescheduleReady(false);
                    setBookingIssue({
                        messageId: latestAssistant.id,
                        content: `The proposed ${booking.time} slot on ${booking.date} is not available. No appointment was booked. Please ask for another listed time.`,
                    });
                    return;
                }
                setBookingData({ ...booking, providerName: provider.name });
                setIsBookingReady(true);
                setIsRescheduleReady(false);
                setBookingIssue(null);
            })
            .catch((error) => {
                if (error instanceof Error && error.name === 'AbortError') return;
                setBookingData(null);
                setIsBookingReady(false);
                setIsRescheduleReady(false);
                setBookingIssue({
                    messageId: latestAssistant.id,
                    content: 'I could not verify that slot against live availability. No appointment was booked. Please try again.',
                });
            });

        return () => controller.abort();
    }, [messages, providerCatalog, isLoading]);

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
        setIsRescheduleReady(false);
        setBookingData(null);
        setBookingIssue(null);
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

            if (!response.ok) {
                const failure = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(failure.error || `Scheduler request failed (${response.status})`);
            }

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

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('Error:', error);
            const isTemporaryProviderFailure = error instanceof Error && error.message.includes('temporarily busy');
            const failureMessage = isTemporaryProviderFailure
                ? 'The scheduling assistant is temporarily busy. Please wait a moment and try again. Your appointment has not been booked.'
                : 'I could not complete that scheduling request. Please try again. Your appointment has not been booked.';
            toast.error(isTemporaryProviderFailure ? 'Scheduler temporarily busy' : 'Scheduling request failed');
            setMessages(prev => {
                // Drop the empty assistant placeholder so a retry starts clean
                // and stale blanks are never saved to history.
                const trimmed = prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content.trim()
                    ? prev.slice(0, -1)
                    : prev;
                return [...trimmed, {
                    id: Date.now().toString(),
                    role: 'assistant' as const,
                    content: failureMessage,
                }];
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, conversationId, input]);

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
            setIsBooking(true);
            const formData = new FormData();
            formData.append('providerId', bookingData.providerId);
            formData.append('date', bookingData.date);
            formData.append('time', bookingData.time);
            formData.append('reason', bookingData.reason);
            formData.append('appointmentType', bookingData.appointmentType);

            try {
                const result = await createAppointment(null, formData);
                if (result.success) {
                    toast.success("Appointment scheduled successfully!");
                    setBookingData(null);
                    setIsBookingReady(false);
                    const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
                    if (latestAssistant) {
                        setBookingIssue({
                            messageId: latestAssistant.id,
                            content: `This appointment is scheduled with ${bookingData.providerName ?? 'the selected provider'} on ${bookingData.date} at ${bookingData.time}.`,
                        });
                    }
                    router.refresh();
                } else {
                    toast.error(`Failed to schedule appointment: ${result.error}`);
                }
            } finally {
                setIsBooking(false);
            }
        } else toast.error('The suggested booking is incomplete. Ask the scheduler for provider, type, date, time, and reason.');
    };

    const handleFinalReschedule = async () => {
        if (!bookingData?.appointmentId || !bookingData.date || !bookingData.time) {
            toast.error('The suggested reschedule is incomplete. Ask the scheduler for another listed time.');
            return;
        }
        setIsBooking(true);
        try {
            const result = await rescheduleAppointment(bookingData.appointmentId, bookingData.date, bookingData.time);
            if (result.success) {
                toast.success(result.message ?? 'Appointment rescheduled');
                setBookingData(null);
                setIsBookingReady(false);
                setIsRescheduleReady(false);
                const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
                if (latestAssistant) {
                    setBookingIssue({
                        messageId: latestAssistant.id,
                        content: `This appointment is rescheduled with ${bookingData.providerName ?? 'the selected provider'} on ${bookingData.date} at ${bookingData.time}.`,
                    });
                }
                router.refresh();
            } else {
                toast.error(result.error ?? 'That slot could not be reserved');
            }
        } finally {
            setIsBooking(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col h-[calc(100vh-160px)] bg-white rounded-lg shadow-md">
            <div className="p-4 border-b">
                <h2 className="text-2xl font-bold text-center">MediClarity AI Scheduler</h2>
                <p className="text-sm text-gray-600 text-center">
                    I can help you find the right doctor. A booking is complete only after you select Schedule Appointment.
                </p>
            </div>

            <div ref={chatContainerRef} className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50">
                {messages.filter(m => m.role !== 'system').map((m, i) => (
                    <div
                        key={i}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`w-fit min-w-0 max-w-[80%] break-words p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none overflow-hidden'}`}>
                            <Markdown>
                                {m.role === 'assistant'
                                    ? bookingIssue?.messageId === m.id ? bookingIssue.content : cleanAssistantText(m.content)
                                    : m.content}
                            </Markdown>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="bg-gray-200 rounded-lg p-3 animate-pulse mr-auto max-w-[80%]">
                        Thinking...
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-white">
                {suggestedDoctors.length > 0 && !isBookingReady && !isRescheduleReady && (
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

                {isRescheduleReady && bookingData && (
                    <Card className="mb-4 bg-amber-50 border-amber-200">
                        <CardHeader>
                            <CardTitle className="text-amber-900">Confirm Reschedule</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p><strong>Provider:</strong> {bookingData.providerName}</p>
                            <p><strong>New date:</strong> {bookingData.date}</p>
                            <p><strong>New time:</strong> {bookingData.time}</p>
                            <Button onClick={handleFinalReschedule} disabled={isBooking} className="mt-4 w-full bg-amber-700 hover:bg-amber-800">
                                {isBooking ? 'Rescheduling...' : 'Reschedule Appointment'}
                            </Button>
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
                            <Button onClick={handleFinalBooking} disabled={isBooking} className="mt-4 w-full bg-green-600 hover:bg-green-700">
                                {isBooking ? 'Scheduling...' : 'Schedule Appointment'}
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
                        disabled={isLoading || isBookingReady || isRescheduleReady}
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || !input.trim() || isBookingReady || isRescheduleReady}
                        className="bg-teal-500 hover:bg-teal-600 text-white"
                    >
                        Send
                    </Button>
                </form>
            </div>
        </div>
    );
}
