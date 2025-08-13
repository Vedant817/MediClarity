/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';
import { z } from 'zod';
import connectDB from '@/lib/db';
import { revalidatePath } from 'next/cache';
import Appointment from '@/models/appointment';

const appointmentSchema = z.object({
    patientId: z.string(),
    providerId: z.string(),
    date: z.string(),
    time: z.string(),
    reason: z.string().min(10),
    preVisitRequirements: z.array(z.string()).optional(),
});

export async function createAppointment(prevState: any, formData: FormData) {
    try {
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

        const existingAppointment = await Appointment.findOne({
            providerId: validatedData.providerId,
            date: validatedData.date,
            time: validatedData.time,
            status: 'scheduled'
        });

        if (existingAppointment) {
            return { error: 'This time slot is no longer available. Please select another.' };
        }

        const newAppointment = new Appointment({
            ...validatedData,
            status: 'scheduled',
        });

        await newAppointment.save();

        revalidatePath('/appointments');
        return { success: true };
    } catch (error) {
        console.error('Appointment creation error:', error);
        if (error instanceof z.ZodError) {
            return { error: error.errors.map(e => e.message).join(', ') };
        }
        return { error: 'Failed to create appointment' };
    }
}

export async function cancelAppointment(appointmentId: string) {
    try {
        await connectDB();

        const appointment = await Appointment.findById(appointmentId);
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
