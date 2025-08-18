import { NextRequest, NextResponse } from "next/server";
import Report from "@/models/report";
import Appointment from "@/models/appointment";
import connectDB from "@/lib/db";
import Provider from "@/models/provider";
import Conversation, { IMessage } from "@/models/conversation";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export async function POST(req: NextRequest) {
    const { messages, userId, conversationId } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
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
            messages: []
        });
    }

    const newUserMessages = messages.filter((msg: IMessage) => 
        !conversation.messages.some((existingMsg: IMessage) => 
            existingMsg.content === msg.content && existingMsg.role === msg.role
        )
    );
    
    conversation.messages.push(...newUserMessages);
    
    const recentReports = await Report.find({ userId }).sort({ createdAt: -1 }).limit(5).lean();
    const pastAppointments = await Appointment.find({ patientId: userId }).sort({ date: -1 }).lean();
    const availableProviders = await Provider.find({}).lean();

    const systemInstruction = `You are a highly intelligent medical appointment scheduling assistant for MediClarity.
        Your primary goal is to help users schedule appointments with the most suitable doctors based on their needs, medical history, and preferences.

        **User's Medical Context:**
        - **Recent Reports:** ${JSON.stringify(recentReports)}
        - **Past Appointments:** ${JSON.stringify(pastAppointments)}
        - **Available Providers:** ${JSON.stringify(availableProviders)}

        **Your Task Flow:**
        1.  **Analyze the User's Request:** Carefully read the user's message to understand their current issue, symptoms, or desired appointment type.
        2.  **Synthesize Medical Context:** Cross-reference the user's request with their medical context to identify relevant history, conditions, and previous providers.
        3.  **Suggest Doctors:** Based on your analysis, suggest 2-3 suitable doctors from the "Available Providers" list. For each doctor, provide a clear justification for your recommendation, referencing the user's medical context.
        4.  **Format Suggestions:** Present the suggestions in a structured JSON format, hidden from the user, using the "SUGGESTED_DOCTORS" tag. Example:
            SUGGESTED_DOCTORS
            [
                {"id": "provider_id_1", "name": "Dr. Emily White", "specialty": "Cardiology", "justification": "Based on your high cholesterol report, a preventative cardiologist like Dr. White would be a great choice."},
                {"id": "provider_id_2", "name": "Dr. John Smith", "specialty": "Cardiology", "justification": "You've seen Dr. Smith before, and he is familiar with your history."}
            ]
        5.  **Handle User Preferences:** If the user selects a doctor, proceed with scheduling. If they want a different doctor, accommodate their request.
        6.  **Gather Scheduling Details:** Ask for the user's preferred date and time.
        7.  **Final Confirmation:** Once a time is chosen, confirm all details.
        8.  **Booking Ready:** When confirmed, include "BOOKING_READY" and a JSON summary of the booking details.

        **Interaction Style:**
        - Be empathetic, professional, and conversational.
        - Keep your responses concise and easy to understand.
        
        **Conversation History:**
        Remember the entire conversation history to provide contextually relevant responses and maintain continuity.
        `;

    try {
        const model = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash",
            maxOutputTokens: 1500,
            temperature: 0.8,
            topP: 0.9,
            topK: 50,
        });

        const recentConversationMessages = conversation.messages.slice(-10);
        const langchainMessages = [
            new SystemMessage(systemInstruction),
            ...recentConversationMessages.map((msg: IMessage) => 
                msg.role === 'user' ? new HumanMessage(msg.content) : new SystemMessage(msg.content)
            )
        ];

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const response = await model.stream(langchainMessages);
                    let fullResponse = '';
                    
                    for await (const chunk of response) {
                        const content = chunk.content;
                        controller.enqueue(content);
                        fullResponse += content;
                    }
                    
                    conversation.messages.push({
                        role: 'assistant',
                        content: fullResponse,
                        timestamp: new Date()
                    });
                    
                    await conversation.save();
                    
                    controller.close();
                } catch (error) {
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