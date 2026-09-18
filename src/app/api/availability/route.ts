import { NextResponse } from "next/server";
import { isCanonicalAppointmentDate } from "@/lib/appointment-slot";
import { getAvailability } from "@/lib/availability";
import { auth } from "@clerk/nextjs/server";
import Appointment from "@/models/appointment";

export async function GET(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const providerId = searchParams.get('providerId');
        const date = searchParams.get('date');

        if (!providerId || !date) {
            return NextResponse.json({ error: "Provider ID and date are required" }, { status: 400 });
        }

        if (!isCanonicalAppointmentDate(date)) {
            return NextResponse.json({ error: "Date must be a valid YYYY-MM-DD date" }, { status: 400 });
        }
        const excludeAppointmentId = searchParams.get("excludeAppointmentId")?.trim() || undefined;
        const availability = await getAvailability(providerId, date, { excludeAppointmentId });
        const availableTimes = availability[date].timeSlots
            .filter((slot) => slot.available)
            .map((slot) => slot.time);
        const ownedQuery: Record<string, unknown> = {
            patientId: userId,
            providerId,
            date,
            status: 'scheduled',
        };
        if (excludeAppointmentId) ownedQuery._id = { $ne: excludeAppointmentId };
        const ownedScheduledTimes = await Appointment.find(ownedQuery).distinct('time');
        return NextResponse.json({ availableTimes, ownedScheduledTimes, availability });

    } catch (error) {
        console.error("Failed to fetch availability:", error);
        return NextResponse.json({ error: "An error occurred while fetching availability." }, { status: 500 });
    }
}
