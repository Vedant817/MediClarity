'use client';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { appointmentTypes } from '@/lib/data';
import { appointmentDateInTimeZone } from '@/lib/appointment-slot';
import { createAppointment } from '@/actions/appointment';
import { useAppointmentStore } from '@/store/appointment';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Provider = {
    id: string;
    name: string;
    specialty: string;
};

export default function EnhancedAppointmentFlow({ providers }: { providers: Provider[] }) {
    const { user } = useUser();
    const [state, formAction] = useFormState(createAppointment, null);
    const {
        activeStep,
        selectedType,
        selectedDate,
        selectedTime,
        selectedProvider,
        setActiveStep,
        setSelectedType,
        setSelectedDate,
        setSelectedTime,
        setSelectedProvider,
        reset,
    } = useAppointmentStore();
    const [availableTimes, setAvailableTimes] = useState<Array<{ value: string; label: string }>>([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);

    useEffect(() => {
        if (!selectedProvider || !selectedDate) {
            setAvailableTimes([]);
            return;
        }
        const controller = new AbortController();
        setAvailabilityLoading(true);
        setSelectedTime('');
        fetch(`/api/availability?providerId=${encodeURIComponent(selectedProvider)}&date=${selectedDate}&seek=1`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('Availability could not be loaded');
                return response.json() as Promise<{
                    date?: string;
                    availability: Record<string, { timeSlots: Array<{ time: string; label: string; available: boolean }> }>;
                }>;
            })
            .then((data) => {
                const resolvedDate = data.date && data.date !== selectedDate ? data.date : selectedDate;
                if (data.date && data.date !== selectedDate) setSelectedDate(data.date);
                setAvailableTimes((data.availability[resolvedDate]?.timeSlots ?? []).filter((slot) => slot.available).map((slot) => ({ value: slot.time, label: slot.label })));
            })
            .catch((error: Error) => {
                if (error.name !== 'AbortError') {
                    setAvailableTimes([]);
                    toast.error(error.message);
                }
            })
            .finally(() => setAvailabilityLoading(false));
        return () => controller.abort();
    }, [selectedDate, selectedProvider, setSelectedTime]);

    useEffect(() => {
        if (state?.success) {
            toast.success('Appointment scheduled successfully!');
            reset();
        } else if (state?.error) {
            toast.error(state.error);
        }
    }, [state, reset]);

    const steps = [
        {
            title: 'Appointment Type',
            content: (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {appointmentTypes.map((type) => (
                        <div
                            key={type.id}
                            className={`border rounded-lg p-4 cursor-pointer ${selectedType === type.id ? 'border-blue-500 bg-blue-50' : ''
                                }`}
                            onClick={() => setSelectedType(type.id)}
                        >
                            <h3 className="font-semibold">{type.name}</h3>
                            <p className="text-sm text-gray-600">{type.description}</p>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Date & Time',
            content: (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Date</label>
                        <input
                            type="date"
                            className="w-full border rounded p-2"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={appointmentDateInTimeZone()}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Physician</label>
                        <Select value={selectedProvider || undefined} onValueChange={setSelectedProvider}>
                            <SelectTrigger aria-label="Physician" className="w-full">
                                <SelectValue placeholder="Select a physician" />
                            </SelectTrigger>
                            <SelectContent>
                                {providers.map((provider) => (
                                    <SelectItem key={provider.id} value={provider.id}>
                                        {provider.name} — {provider.specialty}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Available time</label>
                        <Select
                            value={selectedTime || undefined}
                            onValueChange={setSelectedTime}
                            disabled={!selectedProvider || !selectedDate || availabilityLoading}
                        >
                            <SelectTrigger aria-label="Available time" className="w-full">
                                <SelectValue placeholder={availabilityLoading ? 'Loading availability…' : availableTimes.length ? 'Select a time' : 'No configured slots'} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTimes.map((slot) => (
                                    <SelectItem key={slot.value} value={slot.value}>
                                        {slot.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            ),
        },
        {
            title: 'Confirm',
            content: (
                <div>
                    <form action={formAction}>
                        <input type="hidden" name="appointmentType" value={selectedType} />
                        <input type="hidden" name="providerId" value={selectedProvider} />
                        <input type="hidden" name="date" value={selectedDate} />
                        <input type="hidden" name="time" value={selectedTime} />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Reason for visit</label>
                                <textarea
                                    name="reason"
                                    className="w-full border rounded p-2"
                                    required
                                    rows={4}
                                />
                            </div>
                            <p className="text-sm text-gray-600">Follow only preparation instructions supplied directly by the selected provider.</p>
                            <SubmitButton />
                        </div>
                    </form>
                    
                </div>
            ),
        },
    ];

    const handleNext = () => {
        if (activeStep === 0 && !selectedType) {
            toast.error("Please select an appointment type");
            return;
        }
        if (activeStep === 1 && (!selectedDate || !selectedTime || !selectedProvider)) {
            toast.error("Please select date, time and provider");
            return;
        }
        setActiveStep(Math.min(activeStep + 1, steps.length - 1));
    };

    const handleBack = () => {
        setActiveStep(Math.max(activeStep - 1, 0));
    };

    if (!user) {
        return <div>Loading...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <ol className="flex items-center w-full">
                    {steps.map((step, index) => (
                        <li key={index} className={`flex items-center ${index !== steps.length - 1 ? 'w-full' : ''}`}>
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full 
                                ${activeStep >= index ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                                {index + 1}
                            </div>
                            <div className={`ml-2 text-sm font-medium ${activeStep >= index ? 'text-blue-600' : 'text-gray-500'}`}>
                                {step.title}
                            </div>
                            {index !== steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-4 ${activeStep > index ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                            )}
                        </li>
                    ))}
                </ol>
            </div>
            <div className="mt-8 p-6 border rounded-lg">
                {steps[activeStep].content}

                <div className="mt-6 flex justify-between">
                    <button
                        type="button"
                        onClick={handleBack}
                        disabled={activeStep === 0}
                        className="px-4 py-2 border rounded text-gray-600 disabled:opacity-50 cursor-pointer"
                    >
                        Back
                    </button>

                    {activeStep < steps.length - 1 && (
                        <button
                            type="button"
                            onClick={handleNext}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 cursor-pointer"
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
            {pending ? 'Scheduling...' : 'Schedule Appointment'}
        </button>
    );
}
