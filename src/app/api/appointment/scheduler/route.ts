import { NextRequest, NextResponse } from "next/server";
import Report from "@/models/report";
import Appointment from "@/models/appointment";
import connectDB from "@/lib/db";
import Provider from "@/models/provider";
import Conversation, { IMessage } from "@/models/conversation";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { auth } from "@clerk/nextjs/server";
import { getLLM, llmContentToText, isRateLimitError, rateLimitDelayMs } from "@/lib/llm";
import { getAvailabilityWindow } from "@/lib/availability";
import { appointmentTypeIds } from "@/lib/data";

export const runtime = "nodejs";
const disclaimer = "For information only, not medical advice.";

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
        conversation = await Conversation.findOne({ _id: conversationId, userId });
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

    const recentReports = await Report.find({ userId })
        .select({ summary: 1, reportDate: 1, sourceLab: 1, createdAt: 1 })
        .sort({ createdAt: -1 }).limit(5).lean();
    const pastAppointments = await Appointment.find({ patientId: userId })
        .select({ providerId: 1, date: 1, time: 1, reason: 1, status: 1 })
        .sort({ date: -1 }).limit(20).lean();
    const availableProviders = await Provider.find({ acceptingNewPatients: true })
        .select({ _id: 0, id: 1, name: 1, specialty: 1, hospital: 1, languages: 1 })
        .sort({ name: 1 }).limit(50).lean();

    const upcomingDates = Array.from({ length: 14 }, (_, offset) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + offset);
        return date.toISOString().slice(0, 10);
    });
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

    const systemInstruction = `You are a highly intelligent medical appointment scheduling assistant for MediClarity.
        Your primary goal is to help users schedule appointments with the most suitable doctors based on their needs, medical history, and preferences.

        **User's Medical Context:**
        - **Recent Reports:** ${JSON.stringify(recentReports)}
        - **Past Appointments:** ${JSON.stringify(pastAppointments)}
        - **Available Providers:** ${JSON.stringify(providersWithOpenings)}
        - **Verified Available Slots (next 14 days):** ${JSON.stringify(openAvailability)}
        - **Allowed Appointment Types:** ${JSON.stringify(appointmentTypeIds)}

        **Your Task Flow:**
        1.  **Analyze the User's Request:** Carefully read the user's message to understand their current issue, symptoms, or desired appointment type.
        2.  **Synthesize Medical Context:** Cross-reference the user's request with their medical context to identify relevant history, conditions, and previous providers.
        3.  **Suggest Doctors:** Suggest only doctors present in "Available Providers" who have at least one verified slot. Never invent, rename, or alter an id, name, specialty, date, or time. If none qualify, say no configured provider is currently available.
        3a. **List Only Free Slots:** The slot matrix contains ONLY free times — every entry is bookable, and anything absent (including already-booked appointments) must never be offered. When asked for a doctor's availability, list the exact date/time pairs from the matrix and nothing else.
        4.  **Format Suggestions:** After the conversational text, write SUGGESTED_DOCTORS followed by a JSON array. Every item must contain only id, name, specialty, and justification copied or derived from the supplied data.
        5.  **Handle User Preferences:** If the user selects a doctor, proceed with scheduling. If they want a different doctor, accommodate their request.
        6.  **Gather Scheduling Details:** Ask for the user's preferred date and time.
        7.  **Final Confirmation:** Once a time is chosen, confirm all details.
        8.  **Booking Ready:** When confirmed, write BOOKING_READY followed by one JSON object containing providerId, providerName, date, time, reason, and appointmentType. The providerId must exist in Available Providers, the exact date/time pair must exist in Verified Available Slots, and appointmentType must be copied from Allowed Appointment Types. Never claim the appointment is booked; the server performs final validation and booking.
        8a. **Booking Field Rules:** date must be YYYY-MM-DD copied from the matrix (never "tomorrow" or any other words); time must be HH:MM 24-hour copied from the matrix (e.g. "10:00", never "10AM"); reason must be at least 10 characters describing the visit; appointmentType must be exactly one id from Allowed Appointment Types (e.g. "check-up", never "checkup").

        **Interaction Style:**
        - Be empathetic, professional, and conversational.
        - Keep your responses concise and easy to understand.
        - You coordinate appointments; you do not diagnose, prescribe, or recommend changing treatment.
        - If urgent warning signs are described, advise contacting local emergency services.
        - End health-related guidance with: "For information only, not medical advice."
        
        **Conversation History:**
        Remember the entire conversation history to provide contextually relevant responses and maintain continuity.
        `;

    try {
        const model = getLLM("scheduler");

        const recentConversationMessages = conversation.messages.slice(-10);
        const langchainMessages = [
            new SystemMessage(systemInstruction),
            ...recentConversationMessages.map((msg: IMessage) => {
                if (msg.role === "assistant") return new AIMessage(msg.content);
                if (msg.role === "system") return new SystemMessage(msg.content);
                return new HumanMessage(msg.content);
            })
        ];

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Transient Groq free-tier failures (429/overload) must not
                    // kill a booking turn: retry while nothing has streamed yet.
                    // Once the first chunk is out, the response is committed.
                    let fullResponse = '';
                    let started = false;
                    for (let attempt = 0; attempt <= 2; attempt += 1) {
                        try {
                            fullResponse = '';
                            for await (const chunk of await model.stream(langchainMessages)) {
                                const content = llmContentToText(chunk.content);
                                if (!content) continue;
                                started = true;
                                controller.enqueue(encoder.encode(content));
                                fullResponse += content;
                            }
                            break;
                        } catch (error) {
                            if (started || !isRateLimitError(error) || attempt === 2) throw error;
                            await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs(error, attempt)));
                        }
                    }

                    if (!fullResponse.trim()) {
                        throw new Error("AI provider returned an empty scheduler response");
                    }
                    if (!fullResponse.includes(disclaimer)) {
                        const suffix = `\n\n${disclaimer}`;
                        controller.enqueue(encoder.encode(suffix));
                        fullResponse += suffix;
                    }

                    conversation.messages.push({
                        role: 'assistant',
                        content: fullResponse,
                        timestamp: new Date()
                    });

                    await conversation.save();

                    controller.close();
                } catch (error) {
                    console.error("AI scheduler stream failed:", error);
                    controller.error(error);
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain',
                'X-Conversation-ID': conversation._id.toString()
            }
        });
    } catch (error) {
        console.error("Error in AI scheduler:", error);
        return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }
}
