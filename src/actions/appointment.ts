'use server';
import { z } from 'zod';
import connectDB from '@/lib/db';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    providerId: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    reason: { type: String, required: true },
    preVisitRequirements: { type: [String], default: [] },
    status: { type: String, default: 'scheduled' },
    createdAt: { type: Date, default: Date.now }
});

const Appointment = mongoose.models.Appointment ||
    mongoose.model('Appointment', AppointmentSchema);

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

        const newAppointment = new Appointment({
            ...validatedData,
            status: 'scheduled',
        });

        await newAppointment.save();

        revalidatePath('/appointments');
        return { success: true };
    } catch (error) {
        console.error('Appointment creation error:', error);
        return { error: 'Failed to create appointment' };
    }
}