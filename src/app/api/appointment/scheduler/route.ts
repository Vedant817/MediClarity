import { NextRequest, NextResponse } from "next/server";
import Report from "@/models/report";
import Appointment from "@/models/appointment";
import connectDB from "@/lib/db";
import Provider from "@/models/provider";
import Conversation, { IMessage } from "@/models/conversation";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getLLM, invokeWithRetry, isTransientLLMError, llmContentToText } from "@/lib/llm";
import { getAvailability, getAvailabilityWindow } from "@/lib/availability";
import { appointmentTypeIds } from "@/lib/data";
import { clinicClock, upcomingAppointmentDates } from "@/lib/appointment-slot";
import {
    boundedSchedulerMessages,
    canonicalizeSchedulerResponse,
    compactSchedulerReports,
    extractSchedulerTaggedJson,
    extractSuggestedDoctors,
    formatVerifiedSlotsForPrompt,
    guardUnverifiedBookingClaim,
    replaceRelativeSchedulerDates,
    resolveRelativeBookingDate,
} from "@/lib/scheduler-context";

export const runtime = "nodejs";
const disclaimer = "For information only, not medical advice.";
const bookingProposalSchema = z.object({
    providerId: z.string().min(1),
    providerName: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    reason: z.string().trim().min(10).max(500),
    appointmentType: z.enum(appointmentTypeIds),
});
const rescheduleProposalSchema = z.object({
    appointmentId: z.string().min(1),
    providerId: z.string().min(1),
    providerName: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
});

export async function POST(req: NextRequest) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    const { messages, conversationId } = await req.json();
    if (!Array.isArray(messages)) {
        return NextResponse.json({ error: "Messages must be an array" }, { status: 400 });
    }

    await connectDB();

    let conversation;
    if (conversationId) {
        conversation = await Conversation.findOne({ _id: conversationId, userId, kind: "appointment" });
        if (!conversation) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }
    } else {
        conversation = new Conversation({
            userId,
            kind: "appointment",
            messages: []
        });
    }

    const newUserMessages = messages.filter((msg: IMessage) =>
        !conversation.messages.some((existingMsg: IMessage) =>
            existingMsg.content === msg.content && existingMsg.role === msg.role
        )
    );

    conversation.messages.push(...newUserMessages);

    const recentReportDocuments = await Report.find({ userId })
        .select({ summary: 1, reportDate: 1, sourceLab: 1, createdAt: 1 })
        .sort({ createdAt: -1 }).limit(3).lean();
    const recentReports = compactSchedulerReports(recentReportDocuments);
    const pastAppointments = await Appointment.find({ patientId: userId })
        .select({ providerId: 1, date: 1, time: 1, reason: 1, status: 1 })
        .sort({ date: -1 }).limit(20).lean();
    const scheduledAppointments = await Appointment.find({ patientId: userId, status: "scheduled" })
        .select({ providerId: 1, date: 1, time: 1, reason: 1, status: 1 })
        .sort({ date: 1, time: 1 }).limit(20).lean();
    const availableProviders = await Provider.find({ acceptingNewPatients: true })
        .select({ _id: 0, id: 1, name: 1, specialty: 1, hospital: 1, languages: 1 })
        .sort({ name: 1 }).limit(50).lean<Array<{ id: string; name: string; specialty: string; hospital?: string; languages?: string[] }>>();

    const clock = clinicClock();
    const upcomingDates = upcomingAppointmentDates(14, new Date(), clock.timeZone);
    const currentDate = clock.date;
    const providerAvailability = await Promise.all(availableProviders.map(async (provider) => {
        const days = await getAvailabilityWindow(provider.id, upcomingDates);
        const slots = Object.entries(days).flatMap(([date, availability]) =>
            availability.timeSlots.filter((slot) => slot.available).map((slot) => ({ date, time: slot.time })));
        return { providerId: provider.id, slots };
    }));
    // Keep the prompt small and truthful: only providers with at least one
    // free slot reach the model, so it can neither invent times nor offer a
    // slot that is already booked (booked times are excluded by
    // getAvailabilityWindow and never appear here).
    const providersWithOpenings = availableProviders.filter((provider) =>
        providerAvailability.some((entry) => entry.providerId === provider.id && entry.slots.length > 0));
    const openAvailability = providerAvailability.filter((entry) => entry.slots.length > 0);

    const formattedSlots = formatVerifiedSlotsForPrompt(openAvailability, providersWithOpenings);
    const rescheduleTargets = scheduledAppointments.map((appointment) => ({
        appointmentId: String(appointment._id),
        providerId: appointment.providerId,
        date: appointment.date,
        time: appointment.time,
        reason: appointment.reason,
        status: appointment.status,
    }));

    const systemInstruction = `You are a highly intelligent medical appointment scheduling assistant for MediClarity.
        Your primary goal is to help users schedule or reschedule appointments with the most suitable doctors based on their needs, medical history, and preferences.

        **User's Medical Context:**
        - **Recent Reports:** ${JSON.stringify(recentReports)}
        - **Past Appointments:** ${JSON.stringify(pastAppointments)}
        - **Scheduled visits the user may reschedule:** ${JSON.stringify(rescheduleTargets)}
        - **Available Providers:** ${JSON.stringify(providersWithOpenings)}
        - **Allowed Appointment Types:** ${JSON.stringify(appointmentTypeIds)}
        - **Clinic clock (authoritative):** now ${clock.date} ${clock.time} (${clock.timeZone}). Today is ${clock.date}. Tomorrow is ${clock.tomorrow}.
        - **Verified Available Slots (future only, next 14 days):**
${formattedSlots || "None"}

        **Your Task Flow:**
        1.  **Analyze the User's Request:** Carefully read the user's message to understand their current issue, symptoms, or desired appointment type.
        2.  **Synthesize Medical Context:** Cross-reference the user's request with their medical context to identify relevant history, conditions, and previous providers.
        3.  **Suggest Doctors:** Suggest only doctors present in "Available Providers" who have at least one verified slot. Never invent, rename, or alter an id, name, specialty, date, or time. If none qualify, say no configured provider is currently available.
        3a. **List Only Free Slots:** The slot list contains ONLY free future times. Never offer a time that has already passed on ${clock.date}. When asked for availability, copy the grouped list (date heading, then one "- HH:MM" bullet per time). Never write multiple slots on one line.
        4.  **Doctor suggestions (machine only):** After the conversational text, on its own line write SUGGESTED_DOCTORS followed by a JSON array of {id, name, specialty, justification}. Never print that JSON, a markdown fence, or the word json in the visible reply.
        5.  **Handle User Preferences:** If the user selects a doctor, proceed with scheduling. If they want a different doctor, accommodate their request.
        6.  **Relative dates:** "today" means ${clock.date}. "tomorrow" means ${clock.tomorrow}. Never substitute today when the user said tomorrow.
        7.  **Proposal Confirmation:** Once a time is chosen, ask whether the proposed details are correct. This does not book anything.
        8.  **Booking Ready:** When the user confirms a NEW booking, write BOOKING_READY followed by one JSON object containing providerId, providerName, date, time, reason, and appointmentType. The providerId must exist in Available Providers, the exact date/time pair must exist in Verified Available Slots, and appointmentType must be copied from Allowed Appointment Types. Say only: "Your appointment details are ready. Select Schedule Appointment below to complete the booking." Never say or imply that an appointment is confirmed, booked, scheduled, or reserved, and never promise a reminder; only the authenticated server action can do those things.
        8a. **Booking Field Rules:** In both prose and JSON, use only an absolute YYYY-MM-DD date copied from the matrix. Never use relative words such as "today" or "tomorrow" in the JSON. time must be HH:MM 24-hour copied from the matrix (e.g. "10:00", never "10AM"); reason must be at least 10 characters describing the visit; appointmentType must be exactly one id from Allowed Appointment Types (e.g. "check-up", never "checkup").
        8b. **Machine Format:** BOOKING_READY must be followed immediately by a raw JSON object. Do not wrap the JSON in markdown or a code fence, and do not show it to the user.
        9.  **Reschedule:** If the user wants to move an existing scheduled visit, copy appointmentId from "Scheduled visits the user may reschedule". The new date/time must be in Verified Available Slots for that provider. Write RESCHEDULE_READY followed by {appointmentId, providerId, providerName, date, time}. Say only: "Your reschedule details are ready. Select Reschedule Appointment below to complete the change." Never claim the visit has already been moved. If the requested slot is not in the verified list, say it is already booked or unavailable and ask for another listed time.

        **Interaction Style:**
        - Be empathetic, professional, and conversational.
        - Keep your responses concise and easy to understand.
        - Visible replies are prose and markdown lists only — never JSON.
        - You coordinate appointments; you do not diagnose, prescribe, or recommend changing treatment.
        - If urgent warning signs are described, advise contacting local emergency services.
        - End health-related guidance with: "For information only, not medical advice."
        
        **Conversation History:**
        Remember the entire conversation history to provide contextually relevant responses and maintain continuity.
        `;

    try {
        const model = getLLM("scheduler");

        const recentConversationMessages = boundedSchedulerMessages(conversation.messages);
        const langchainMessages = [
            new SystemMessage(systemInstruction),
            ...recentConversationMessages.map((msg) => {
                if (msg.role === "assistant") return new AIMessage(msg.content);
                if (msg.role === "system") return new SystemMessage(msg.content);
                return new HumanMessage(msg.content);
            })
        ];

        // Resolve the model response before committing HTTP headers. This lets
        // transient 429/5xx/network failures retry safely instead of breaking
        // the browser's response stream halfway through a booking turn.
        const response = await invokeWithRetry(() => model.invoke(langchainMessages));
        let fullResponse = llmContentToText(response.content).trim();
        if (!fullResponse) throw new Error("AI provider returned an empty scheduler response");

        const lastUserText = conversation.messages
            .filter((message: IMessage) => message.role === "user")
            .slice(-4)
            .map((message: IMessage) => message.content)
            .join("\n");
        let bookingCandidate = extractSchedulerTaggedJson<unknown>(fullResponse, "BOOKING_READY");
        let rescheduleCandidate = extractSchedulerTaggedJson<unknown>(fullResponse, "RESCHEDULE_READY");
        if (!bookingCandidate && /appointment details are ready|complete the booking/i.test(fullResponse)) {
            const corrected = await invokeWithRetry(() => model.invoke([
                ...langchainMessages,
                new AIMessage(fullResponse),
                new SystemMessage(
                    "FORMAT CORRECTION: Your previous answer said the booking details were ready but omitted a parseable BOOKING_READY payload. Return the same concise user-facing sentence followed immediately by BOOKING_READY and one raw JSON object with providerId, providerName, date, time, reason, and appointmentType. Use only the verified provider and slot data above. Do not use markdown fences and do not claim the appointment is booked.",
                ),
            ]));
            const correctedText = llmContentToText(corrected.content).trim();
            const correctedCandidate = extractSchedulerTaggedJson<unknown>(correctedText, "BOOKING_READY");
            if (correctedCandidate) {
                fullResponse = correctedText;
                bookingCandidate = correctedCandidate;
            }
        }
        if (!rescheduleCandidate && /reschedule details are ready|select reschedule/i.test(fullResponse)) {
            const corrected = await invokeWithRetry(() => model.invoke([
                ...langchainMessages,
                new AIMessage(fullResponse),
                new SystemMessage(
                    "FORMAT CORRECTION: Your previous answer said reschedule details were ready but omitted a parseable RESCHEDULE_READY payload. Return the same concise user-facing sentence followed immediately by RESCHEDULE_READY and one raw JSON object with appointmentId, providerId, providerName, date, and time. The new slot must be in the verified list. Do not use markdown fences and do not claim the visit was moved.",
                ),
            ]));
            const correctedText = llmContentToText(corrected.content).trim();
            const correctedCandidate = extractSchedulerTaggedJson<unknown>(correctedText, "RESCHEDULE_READY");
            if (correctedCandidate) {
                fullResponse = correctedText;
                rescheduleCandidate = correctedCandidate;
            }
        }

        const suggestedDoctors = extractSuggestedDoctors(fullResponse).filter((doctor) =>
            providersWithOpenings.some((provider) =>
                provider.id === doctor.id && provider.name === doctor.name && provider.specialty === doctor.specialty));

        const slotIsOpen = (providerId: string, date: string, time: string, excludeAppointmentId?: string) =>
            openAvailability.some((entry) =>
                entry.providerId === providerId && entry.slots.some((slot) => slot.date === date && slot.time === time))
            || Boolean(excludeAppointmentId && scheduledAppointments.some((appointment) =>
                String(appointment._id) === excludeAppointmentId
                && appointment.providerId === providerId
                && appointment.date === date
                && appointment.time === time));

        let validatedBooking: z.infer<typeof bookingProposalSchema> | undefined;
        let validatedReschedule: z.infer<typeof rescheduleProposalSchema> | undefined;
        let prose = replaceRelativeSchedulerDates(fullResponse, currentDate);

        const parsedReschedule = rescheduleProposalSchema.safeParse(rescheduleCandidate);
        if (rescheduleCandidate && parsedReschedule.success) {
            const proposal = {
                ...parsedReschedule.data,
                date: resolveRelativeBookingDate(lastUserText, parsedReschedule.data.date, currentDate),
            };
            const existing = scheduledAppointments.find((appointment) => String(appointment._id) === proposal.appointmentId);
            const provider = providersWithOpenings.find((entry) =>
                entry.id === proposal.providerId && entry.name === proposal.providerName)
                ?? availableProviders.find((entry) => entry.id === proposal.providerId && entry.name === proposal.providerName);
            if (existing && provider && slotIsOpen(proposal.providerId, proposal.date, proposal.time, proposal.appointmentId)) {
                const live = await getAvailability(proposal.providerId, proposal.date, {
                    excludeAppointmentId: proposal.appointmentId,
                });
                const open = live[proposal.date]?.timeSlots.some((slot) => slot.time === proposal.time && slot.available);
                if (open || (existing.providerId === proposal.providerId && existing.date === proposal.date && existing.time === proposal.time)) {
                    validatedReschedule = proposal;
                    prose = "Your reschedule details are ready. Select Reschedule Appointment below to complete the change.";
                } else {
                    prose = "That time is already booked or no longer available. Your appointment has not been moved; please choose another listed slot.";
                }
            } else {
                prose = "I could not validate that reschedule. The requested slot may already be booked. Your appointment has not been moved; please choose another listed time.";
            }
        } else if (rescheduleCandidate) {
            prose = "I could not validate the reschedule details. Your appointment has not been moved; please confirm the visit, date, and time again.";
        } else {
            const parsedBooking = bookingProposalSchema.safeParse(bookingCandidate);
            if (bookingCandidate && parsedBooking.success) {
                const proposal = {
                    ...parsedBooking.data,
                    date: resolveRelativeBookingDate(lastUserText, parsedBooking.data.date, currentDate),
                };
                const provider = providersWithOpenings.find((entry) =>
                    entry.id === proposal.providerId && entry.name === proposal.providerName);
                if (provider && slotIsOpen(proposal.providerId, proposal.date, proposal.time)) {
                    validatedBooking = proposal;
                    prose = "Your appointment details are ready. Select Schedule Appointment below to complete the booking.";
                } else {
                    prose = "I could not validate that provider and time as an available booking. Your appointment has not been booked; please choose another listed slot.";
                }
            } else if (bookingCandidate) {
                prose = "I could not validate all required booking details. Your appointment has not been booked; please confirm the provider, date, time, visit type, and reason again.";
            } else {
                prose = guardUnverifiedBookingClaim(fullResponse);
                prose = replaceRelativeSchedulerDates(prose, currentDate);
            }
        }

        fullResponse = canonicalizeSchedulerResponse({
            prose,
            doctors: suggestedDoctors,
            booking: validatedBooking,
            reschedule: validatedReschedule,
        });
        if (!fullResponse.includes(disclaimer)) fullResponse += `\n\n${disclaimer}`;

        conversation.messages.push({
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date()
        });
        await conversation.save();

        return new Response(fullResponse, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Conversation-ID': conversation._id.toString()
            }
        });
    } catch (error) {
        console.error("Error in AI scheduler:", error);
        const transient = isTransientLLMError(error);
        return NextResponse.json(
            { error: transient ? "The scheduling assistant is temporarily busy. Please retry in a moment." : "Failed to generate response" },
            { status: transient ? 503 : 500 },
        );
    }
}
