import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message } from "ai";
import { NextRequest, NextResponse } from "next/server";
import mongoose from 'mongoose';
import Report, { IReport } from "@/models/report";
import Appointment from "@/models/appointment";
import connectDB from "@/lib/db";
import Provider, { IProvider } from "@/models/provider";
import { analyzeMedicalReports } from "@/lib/ai-service";
import { getAvailability } from '@/lib/availability';
import { MedicalReport, findingsToSpecialistMap } from '@/lib/ai-service';

function transformReportData(reports: IReport[]): MedicalReport[] {
    const keywords = Object.keys(findingsToSpecialistMap);
    return reports.map(report => {
        const summary = report.summary.toLowerCase();
        const findings = keywords.filter(keyword => summary.includes(keyword));

        return {
                        id: report._id ? report._id.toString() : new mongoose.Types.ObjectId().toString(),
            date: report.createdAt.toISOString(),
            reportType: 'Medical Summary',
            content: report.summary,
            provider: 'N/A',
            findings: findings,
        };
    });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function scheduleStreaming(genAI: GoogleGenerativeAI, messages: Message[], systemInstruction: string) {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction,
    });

    const chat = model.startChat({
        history: messages.slice(0, -1).map((message) => ({
            role: message.role === "user" ? "user" : "model",
            parts: [{ text: message.content }],
        })),
        generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.8,
            topP: 0.9,
            topK: 50,
        },
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.content);
    return result.stream;
}

export async function POST(req: NextRequest) {
    const { messages, userId } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    await connectDB();

        const recentReports = await Report.find({ userId }).sort({ createdAt: -1 }).limit(5).lean<IReport[]>();
        const pastAppointments = await Appointment.find({ patientId: userId }).sort({ date: -1 }).lean();
        const availableProviders = await Provider.find({}).lean<IProvider[]>();

    const transformedReports = transformReportData(recentReports);
    const recommendations = await analyzeMedicalReports(transformedReports, pastAppointments);

    let providerAvailabilityContext = {};
    if (recommendations.length > 0) {
        const primarySpecialist = recommendations[0].specialistType;
                const recommendedProvider = availableProviders.find(p => p.specialty === primarySpecialist);

        if (recommendedProvider) {
            const today = new Date();
            const upcomingDates = [];
            for (let i = 0; i < 7; i++) {
                const nextDay = new Date(today);
                nextDay.setDate(today.getDate() + i);
                upcomingDates.push(nextDay.toISOString().split('T')[0]);
            }

                        const availabilityPromises = upcomingDates.map(date => getAvailability(recommendedProvider.id, date));
            const availabilityResults = await Promise.all(availabilityPromises);
            
            const providerAvailability = availabilityResults.reduce((acc, curr) => {
                return {...acc, ...curr};
            }, {});

            providerAvailabilityContext = {
                                providerId: recommendedProvider.id,
                providerName: recommendedProvider.name,
                availability: providerAvailability
            };
        }
    }

    const systemInstruction = `You are Clara, a friendly, empathetic, and highly efficient medical scheduling assistant for MediClarity.
    Your primary goal is to provide a seamless and reassuring experience for users scheduling appointments, making them feel cared for and confident in their choice of provider.

    **User's Medical Context:**
    - **Recent Reports:** ${JSON.stringify(recentReports)}
    - **Past Appointments:** ${JSON.stringify(pastAppointments)}
    - **AI-Generated Recommendations:** ${JSON.stringify(recommendations)}
    - **Available Providers:** ${JSON.stringify(availableProviders)}
    - **Upcoming Availability for Recommended Doctor:** ${JSON.stringify(providerAvailabilityContext)}

    **Your Task Flow:**
    1.  **Greet and Analyze:** Start with a warm greeting. Analyze the user's request in the context of their medical history and our AI recommendations.
    2.  **Suggest Doctors:** Proactively suggest 1-2 of the most suitable doctors. Justify your suggestions clearly, referencing their medical context. Always present these suggestions conversationally to the user.
    3.  **Format Suggestions (Internal):** In the same message, include a hidden JSON block with the suggested doctors using the 'SUGGESTED_DOCTORS' tag for the UI to display them.
        SUGGESTED_DOCTORS
        [
            {"id": "provider_id_1", "name": "Dr. Emily White", "specialty": "Cardiology", "justification": "Based on your high cholesterol report, a preventative cardiologist like Dr. White would be a great choice."},
            {"id": "provider_id_2", "name": "Dr. John Smith", "specialty": "Cardiology", "justification": "You've seen Dr. Smith before, and he is familiar with your history."}
        ]
    4.  **Propose a Time:** Once the user selects a doctor, use the 'Upcoming Availability' data to find the best available slot (the earliest one that fits the urgency). Propose this specific time to the user. For example: 'Dr. White has an opening tomorrow, May 5th, at 9:00 AM. Would that work for you?'
    5.  **Confirm and Finalize:** If the user agrees, confirm the details one last time. Then, immediately provide the final booking information in a hidden JSON block with the 'BOOKING_READY' tag.
        BOOKING_READY
        {"providerId": "provider_id_1", "providerName": "Dr. Emily White", "date": "2025-05-05", "time": "09:00 AM", "reason": "Follow-up for high cholesterol"}

    **Interaction Style:**
    - **Empathetic & Reassuring:** Always be warm and understanding. Acknowledge the user's potential health concerns. Use phrases like 'I understand,' 'I'm here to help,' and 'Taking care of your health is the priority.'
    - **Clear & Concise:** Keep your responses simple and to the point. Avoid medical jargon.
    - **Proactive & Efficient:** Guide the user smoothly through the process, anticipating their needs to make booking an appointment effortless.
    `;

    const userMessages = messages.filter((m: Message) => m.role !== 'system');

    const response = await scheduleStreaming(genAI, userMessages, systemInstruction);
    const stream = new ReadableStream({
        async start(controller) {
            for await (const chunk of response) {
                controller.enqueue(chunk.text());
            }
            controller.close();
        },
    });

    return new Response(stream);
}