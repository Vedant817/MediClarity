"use client";
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Stethoscope } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useUser } from '@clerk/nextjs';
import { cancelAppointment, getAppointments, rescheduleAppointment, updateAppointmentStatus } from '@/actions/appointment';
import { appointmentDateInTimeZone } from '@/lib/appointment-slot';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { TimelineEvent } from '@/types';

interface Appointment {
    _id: string;
    date: string;
    time?: string;
    providerId: string;
    reason: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
}

function formatProviderId(providerId: string) {
    if (!providerId) return '';

    return providerId
        .split('-')
        .map((word, idx) => {
            const formatted = word.charAt(0).toUpperCase() + word.slice(1);
            return idx === 0 ? formatted + '.' : formatted;
        })
        .join(' ');
}

function TimelineSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
                <Card key={index}>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function HealthTimeline() {
    const [loading, setLoading] = useState(true);
    const [appointments, setAppointments] = useState<TimelineEvent[]>([]);
    const { user } = useUser();
    const [rescheduleEvent, setRescheduleEvent] = useState<TimelineEvent | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('');
    const [rescheduleTimes, setRescheduleTimes] = useState<Array<{ value: string; label: string }>>([]);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);
    const [rescheduleSaving, setRescheduleSaving] = useState(false);

    const fetchAppointments = async () => {
        setLoading(true);
        const fetchedAppointments = await getAppointments();
        const formattedAppointments = fetchedAppointments.map((apt: Appointment) => ({
            id: apt._id,
            date: apt.date,
            time: apt.time ?? "",
            title: `Appointment with ${formatProviderId(apt.providerId)}`,
            description: apt.reason,
            status: apt.status,
            providerId: apt.providerId,
            createdAt: apt.createdAt,
            updatedAt: apt.updatedAt,
            type: 'appointment' as const,
        }));
        setAppointments(
            formattedAppointments.sort(
                (a: { date: string | number | Date; }, b: { date: string | number | Date; }) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
        setLoading(false);
    };

    useEffect(() => {
        if (user) fetchAppointments();
    }, [user]);

    const handleCancel = async (appointmentId: string) => {
        const result = await cancelAppointment(appointmentId);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Appointment cancelled successfully");
            fetchAppointments();
        }
    };

    const handleOutcome = async (appointmentId: string, status: 'attended' | 'unattended') => {
        const result = await updateAppointmentStatus(appointmentId, status);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success(result.message ?? "Appointment updated successfully");
            fetchAppointments();
        }
    };

    const isPastVisit = (date: string) => {
        return date < appointmentDateInTimeZone();
    };

    useEffect(() => {
        if (!rescheduleEvent?.providerId || !rescheduleDate) {
            setRescheduleTimes([]);
            return;
        }
        const controller = new AbortController();
        setRescheduleLoading(true);
        setRescheduleTime('');
        fetch(`/api/availability?providerId=${encodeURIComponent(rescheduleEvent.providerId)}&date=${encodeURIComponent(rescheduleDate)}&excludeAppointmentId=${encodeURIComponent(rescheduleEvent.id)}`, { signal: controller.signal, cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) throw new Error('Availability could not be loaded');
                return response.json() as Promise<{ availability: Record<string, { timeSlots: Array<{ time: string; label: string; available: boolean }> }> }>;
            })
            .then((data) => {
                setRescheduleTimes((data.availability[rescheduleDate]?.timeSlots ?? [])
                    .filter((slot) => slot.available)
                    .map((slot) => ({ value: slot.time, label: slot.label })));
            })
            .catch((error: Error) => {
                if (error.name !== 'AbortError') {
                    setRescheduleTimes([]);
                    toast.error(error.message);
                }
            })
            .finally(() => setRescheduleLoading(false));
        return () => controller.abort();
    }, [rescheduleDate, rescheduleEvent]);

    const openReschedule = (event: TimelineEvent) => {
        setRescheduleEvent(event);
        setRescheduleDate(event.date);
        setRescheduleTime(event.time ?? '');
    };

    const handleReschedule = async () => {
        if (!rescheduleEvent || !rescheduleDate || !rescheduleTime) {
            toast.error('Choose an open date and time');
            return;
        }
        setRescheduleSaving(true);
        const result = await rescheduleAppointment(rescheduleEvent.id, rescheduleDate, rescheduleTime);
        setRescheduleSaving(false);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        toast.success(result.message ?? 'Appointment rescheduled');
        setRescheduleEvent(null);
        fetchAppointments();
    };

    const formatStamp = (value?: string) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.valueOf())) return null;
        return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled':
                return <Badge variant="secondary">Scheduled</Badge>;
            case 'attended':
                return <Badge variant="default">Attended</Badge>;
            case 'unattended':
                return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Unattended</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            case 'completed':
                return <Badge variant="secondary">Completed</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Your Appointments</h1>
            </div>
            <ToastContainer />
            {loading ? (
                <TimelineSkeleton />
            ) : (
                <div className="space-y-4">
                    <ScrollArea className="h-[calc(100vh-245px)] px-4">
                        {appointments.map((event) => (
                            <Card key={event.id} className='mb-4'>
                                <CardHeader className="flex flex-row justify-between items-center">
                                    <CardTitle>{event.title}</CardTitle>
                                    {getStatusBadge(event.status || '')}
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                                        <Calendar className="h-4 w-4" />
                                        <span>
                                            {new Date(event.date).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                        </span>
                                        {event.time ? (
                                            <>
                                                <Clock className="ml-3 h-4 w-4" aria-hidden="true" />
                                                <span>{event.time}</span>
                                            </>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center space-x-2 mt-2 text-sm text-gray-500">
                                        <Stethoscope className="h-4 w-4" />
                                        <span>{event.description}</span>
                                    </div>
                                    {(event.createdAt || event.updatedAt) && (
                                        <p className="mt-3 text-xs text-gray-500">
                                            {event.createdAt ? `Booked ${formatStamp(event.createdAt)}` : null}
                                            {event.updatedAt && event.createdAt && new Date(event.updatedAt).getTime() - new Date(event.createdAt).getTime() > 1000
                                                ? ` · Last updated ${formatStamp(event.updatedAt)}`
                                                : null}
                                        </p>
                                    )}
                                    <div className="flex justify-end mt-4 space-x-2">
                                        {event.status === 'scheduled' && isPastVisit(event.date) && (
                                            <p className="mr-auto self-center text-xs text-amber-800">
                                                This visit date has passed — record what happened.
                                            </p>
                                        )}
                                        {event.status === 'scheduled' && isPastVisit(event.date) && (
                                            <>
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    className='cursor-pointer'
                                                    onClick={() => handleOutcome(event.id, 'attended')}
                                                >
                                                    Mark attended
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className='cursor-pointer border-amber-300 text-amber-800 hover:bg-amber-50'
                                                    onClick={() => handleOutcome(event.id, 'unattended')}
                                                >
                                                    Mark unattended
                                                </Button>
                                            </>
                                        )}
                                        {event.status === 'scheduled' && !isPastVisit(event.date) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="cursor-pointer"
                                                onClick={() => openReschedule(event)}
                                            >
                                                Reschedule
                                            </Button>
                                        )}
                                        {event.status === 'scheduled' && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" className='cursor-pointer hover:bg-red-800 transition-colors'>
                                                        Cancel
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to cancel this appointment?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className='cursor-pointer'>Back</AlertDialogCancel>
                                                        <AlertDialogAction
                                                        className='bg-red-600 hover:bg-red-700 transition-colors cursor-pointer'
                                                            onClick={() => handleCancel(event.id)}
                                                        >
                                                            Yes, Cancel
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </ScrollArea>
                </div>
            )}
            <Dialog open={Boolean(rescheduleEvent)} onOpenChange={(open) => { if (!open) setRescheduleEvent(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reschedule appointment</DialogTitle>
                        <DialogDescription>
                            {rescheduleEvent
                                ? `Choose a free slot with ${formatProviderId(rescheduleEvent.providerId ?? '')}. Booked times stay blocked.`
                                : 'Choose a free slot.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium" htmlFor="reschedule-date">Date</label>
                            <Input
                                id="reschedule-date"
                                type="date"
                                min={appointmentDateInTimeZone()}
                                value={rescheduleDate}
                                onChange={(event) => setRescheduleDate(event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium" htmlFor="reschedule-time">Available time</label>
                            <select
                                id="reschedule-time"
                                className="w-full rounded border p-2"
                                value={rescheduleTime}
                                onChange={(event) => setRescheduleTime(event.target.value)}
                                disabled={!rescheduleDate || rescheduleLoading}
                            >
                                <option value="">{rescheduleLoading ? 'Loading availability…' : rescheduleTimes.length ? 'Select a time' : 'No open slots'}</option>
                                {rescheduleTimes.map((slot) => (
                                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRescheduleEvent(null)}>Back</Button>
                        <Button onClick={handleReschedule} disabled={rescheduleSaving || !rescheduleDate || !rescheduleTime}>
                            {rescheduleSaving ? 'Saving…' : 'Save new time'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
