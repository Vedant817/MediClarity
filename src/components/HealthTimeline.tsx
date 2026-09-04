"use client";
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Stethoscope } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useUser } from '@clerk/nextjs';
import { cancelAppointment, getAppointments } from '@/actions/appointment';
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
    providerId: string;
    reason: string;
    status: string;
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

    const fetchAppointments = async () => {
        setLoading(true);
        const fetchedAppointments = await getAppointments();
        const formattedAppointments = fetchedAppointments.map((apt: Appointment) => ({
            id: apt._id,
            date: apt.date,
            title: `Appointment with ${formatProviderId(apt.providerId)}`,
            description: apt.reason,
            status: apt.status,
            providerId: formatProviderId(apt.providerId),
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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled':
                return <Badge variant="default">Scheduled</Badge>;
            case 'completed':
                return <Badge variant="secondary">Completed</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
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
                                    </div>
                                    <div className="flex items-center space-x-2 mt-2 text-sm text-gray-500">
                                        <Stethoscope className="h-4 w-4" />
                                        <span>{event.description}</span>
                                    </div>
                                    <div className="flex justify-end mt-4 space-x-2">
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
        </div>
    );
}
