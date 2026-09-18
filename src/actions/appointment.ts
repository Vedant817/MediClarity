/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';
import { z } from 'zod';
import connectDB from '@/lib/db';
import { revalidatePath } from 'next/cache';
import Appointment from '@/models/appointment';
import { isCanonicalAppointmentDate, isCanonicalAppointmentTime, normalizeAppointmentTime } from '@/lib/appointment-slot';
import { auth } from '@clerk/nextjs/server';
import { getAvailability } from '@/lib/availability';
import { PATIENT_SETTABLE_STATUSES } from '@/lib/appointments';
import { appointmentTypeIds } from '@/lib/data';

const appointmentSchema = z.object({
    providerId: z.string(),
    appointmentType: z.enum(appointmentTypeIds),
    date: z.string().refine(isCanonicalAppointmentDate, 'Date must be a valid YYYY-MM-DD date'),
    time: z.string().transform(normalizeAppointmentTime).refine(isCanonicalAppointmentTime, 'Time must be one of the available appointment slots'),
    reason: z.string().min(10),
    preVisitRequirements: z.array(z.string()).optional(),
});

export async function createAppointment(prevState: any, formData: FormData) {
    try {
        const { userId } = await auth();
        if (!userId) return { error: 'User not authenticated' };

        await connectDB();

        const rawData = Object.fromEntries(formData.entries());

        let preVisitRequirements: string[] = [];
        if (formData.getAll('preVisitRequirements').length > 0) {
            preVisitRequirements = formData.getAll('preVisitRequirements') as string[];
        }

        const dataToValidate = {
            ...rawData,
            preVisitRequirements
        };

        const validatedData = appointmentSchema.parse(dataToValidate);

        const availability = await getAvailability(validatedData.providerId, validatedData.date);
        const selectedSlot = availability[validatedData.date]?.timeSlots.find((slot) => slot.time === validatedData.time);
        if (!selectedSlot?.available) {
            return { error: 'This time slot is no longer available. Please select another.' };
        }

        const newAppointment = new Appointment({
            ...validatedData,
            patientId: userId,
            status: 'scheduled',
        });

        await newAppointment.save();

        revalidatePath('/dashboard/appointments');
        return { success: true };
    } catch (error) {
        console.error('Appointment creation error:', error);
        if (error instanceof z.ZodError) {
            return { error: error.issues.map((issue) => issue.message).join(', ') };
        }
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            return { error: 'This time slot is no longer available. Please select another.' };
        }
        return { error: 'Failed to create appointment' };
    }
}

export async function cancelAppointment(appointmentId: string) {
    return updateAppointmentStatus(appointmentId, 'cancelled');
}

/**
 * Record what happened with a visit: attended, cancelled, or unattended.
 * Only a currently-scheduled visit can transition; terminal visits are
 * immutable. Cancelling or marking unattended releases the provider slot
 * (the uniqueness index only covers scheduled visits).
 */
export async function updateAppointmentStatus(appointmentId: string, status: string) {
    try {
        const parsed = z.enum(PATIENT_SETTABLE_STATUSES).safeParse(status);
        if (!parsed.success) {
            return { error: 'Invalid appointment status. Use attended, cancelled, or unattended.' };
        }

        const { userId } = await auth();
        if (!userId) return { error: 'User not authenticated' };

        await connectDB();

        // Atomic conditional update: only a currently-scheduled visit moves.
        // Scoped validators run on the $set paths only, so legacy documents
        // missing unrelated fields still transition cleanly. Concurrent
        // double-submits resolve to a single winner; losers see no match.
        const appointment = await Appointment.findOneAndUpdate(
            { _id: appointmentId, patientId: userId, status: "scheduled" },
            { $set: { status: parsed.data } },
            { new: true },
        );
        if (!appointment) {
            const exists = await Appointment.exists({ _id: appointmentId, patientId: userId });
            return {
                error: exists
                    ? 'Only scheduled visits can be updated. This visit already has an outcome.'
                    : 'Appointment not found',
            };
        }

        revalidatePath('/dashboard/appointments');
        const labels: Record<string, string> = {
            attended: 'marked as attended',
            cancelled: 'cancelled',
            unattended: 'marked as unattended',
        };
        return { success: true, message: `Appointment ${labels[parsed.data] ?? 'updated'} successfully` };
    } catch (error) {
        console.error('Appointment status update error:', error);
        return { error: 'Failed to update appointment' };
    }
}

export async function rescheduleAppointment(appointmentId: string, date: string, time: string) {
    try {
        const { userId } = await auth();
        if (!userId) return { error: 'User not authenticated' };

        const parsed = z.object({
            appointmentId: z.string().min(1),
            date: z.string().refine(isCanonicalAppointmentDate, 'Date must be a valid YYYY-MM-DD date'),
            time: z.string().transform(normalizeAppointmentTime).refine(isCanonicalAppointmentTime, 'Time must be one of the available appointment slots'),
        }).safeParse({ appointmentId, date, time });
        if (!parsed.success) {
            return { error: parsed.error.issues.map((issue) => issue.message).join(', ') };
        }

        await connectDB();
        const appointment = await Appointment.findOne({
            _id: parsed.data.appointmentId,
            patientId: userId,
            status: 'scheduled',
        });
        if (!appointment) {
            const exists = await Appointment.exists({ _id: parsed.data.appointmentId, patientId: userId });
            return {
                error: exists
                    ? 'Only scheduled visits can be rescheduled.'
                    : 'Appointment not found',
            };
        }

        if (appointment.date === parsed.data.date && appointment.time === parsed.data.time) {
            return { success: true, message: 'Appointment is already at that time' };
        }

        const availability = await getAvailability(appointment.providerId, parsed.data.date, {
            excludeAppointmentId: String(appointment._id),
        });
        const selectedSlot = availability[parsed.data.date]?.timeSlots.find((slot) => slot.time === parsed.data.time);
        if (!selectedSlot?.available) {
            return { error: 'That time is not available. Choose another open slot.' };
        }

        appointment.date = parsed.data.date;
        appointment.time = parsed.data.time;
        await appointment.save();

        revalidatePath('/dashboard/appointments');
        return { success: true, message: `Appointment rescheduled to ${parsed.data.date} at ${parsed.data.time}` };
    } catch (error) {
        console.error('Appointment reschedule error:', error);
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            return { error: 'That time slot is already booked. Please select another.' };
        }
        return { error: 'Failed to reschedule appointment' };
    }
}

export async function getAppointments() {
    try {
        const { userId } = await auth();
        if (!userId) return [];

        await connectDB();
        const appointments = await Appointment.find({ patientId: userId }).lean();
        return JSON.parse(JSON.stringify(appointments));
    } catch (error) {
        console.error('Error fetching appointments:', error);
        return [];
    }
}
