/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';
import { z } from 'zod';
import connectDB from '@/lib/db';
import { revalidatePath } from 'next/cache';
import Appointment from '@/models/appointment';
import { isCanonicalAppointmentDate, isCanonicalAppointmentTime, normalizeAppointmentTime } from '@/lib/appointment-slot';
import { auth } from '@clerk/nextjs/server';
import { getAvailability } from '@/lib/availability';
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

        revalidatePath('/appointments');
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
    try {
        const { userId } = await auth();
        if (!userId) return { error: 'User not authenticated' };

        await connectDB();

        const appointment = await Appointment.findOne({ _id: appointmentId, patientId: userId });
        if (!appointment) {
            return { error: 'Appointment not found' };
        }

        appointment.status = 'cancelled';
        await appointment.save();

        revalidatePath('/appointments');
        return { success: true };
    } catch (error) {
        console.error('Cancellation error:', error);
        return { error: 'Failed to cancel appointment' };
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
