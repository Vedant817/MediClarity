'use client';
import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import type { ProviderAvailability } from '@/lib/availability';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

function toLocalIsoDate(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

export default function AvailabilityCalendar({ providerId }: { providerId: string }) {
    const [date, setDate] = useState<Value>(new Date());
    const [availability, setAvailability] = useState<ProviderAvailability>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchAvailability = async () => {
            if (!date) return;

            setLoading(true);
            try {
                const dateStr = date instanceof Date ? toLocalIsoDate(date) : '';
                const response = await fetch(`/api/availability?providerId=${encodeURIComponent(providerId)}&date=${dateStr}`);
                if (!response.ok) throw new Error('Failed to load availability');
                const data = await response.json();
                setAvailability(data.availability);
            } catch (error) {
                console.error('Error fetching availability:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAvailability();
    }, [date, providerId]);

    const tileContent = ({ date, view }: { date: Date; view: string }) => {
        if (view !== 'month') return null;

        const dateStr = toLocalIsoDate(date);
        const dayAvailability = availability[dateStr];

        if (!dayAvailability) return null;

        return (
            <div className="absolute bottom-1 right-1 text-xs">
                {dayAvailability.slots > 0 ? (
                    <span className="text-green-500">✓ {dayAvailability.slots}</span>
                ) : (
                    <span className="text-red-500">✗</span>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
                <Calendar
                    onChange={setDate}
                    value={date}
                    tileContent={tileContent}
                    minDate={new Date()}
                    className="border rounded-lg p-2"
                />
            </div>

            <div className="flex-1">
                {loading ? (
                    <div>Loading time slots...</div>
                ) : (
                    <TimeSlotList
                        date={date}
                        availability={availability}
                    />
                )}
            </div>
        </div>
    );
}

function TimeSlotList({ date, availability }: { date: Value, availability: ProviderAvailability }) {
    if (!date || !(date instanceof Date)) return null;

    const dateStr = toLocalIsoDate(date);
    const dayAvailability = availability[dateStr];

    if (!dayAvailability?.slots) {
        return <div>No availability for this date</div>;
    }

    return (
        <div className="space-y-2">
            <h3 className="font-semibold">
                Available times for {date.toLocaleDateString()}
            </h3>
            <div className="grid grid-cols-2 gap-2">
                {dayAvailability.timeSlots.filter((slot) => slot.available).map((slot) => (
                    <button
                        key={slot.time}
                        className="border rounded p-2 hover:bg-blue-50"
                    >
                        {slot.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
