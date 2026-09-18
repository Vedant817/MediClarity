import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Conversation from "@/models/conversation";
import Appointment from "@/models/appointment";
import { auth } from "@clerk/nextjs/server";
import { retireConsumedProposalMessages } from "@/lib/scheduler-context";

export async function GET(req: NextRequest) {
    const { userId } = await auth();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    try {
        let conversation;
        
        if (conversationId) {
            // Fetch specific conversation
            conversation = await Conversation.findOne({
                _id: conversationId,
                userId,
                kind: 'appointment',
            });
        } else {
            // Fetch latest conversation for user
            conversation = await Conversation.findOne({ userId, kind: 'appointment' })
                .sort({ updatedAt: -1 });
        }

        if (!conversation) {
            return NextResponse.json({ messages: [], scheduledAppointments: [] });
        }

        const scheduledAppointments = await Appointment.find({ patientId: userId, status: "scheduled" })
            .select({ providerId: 1, date: 1, time: 1 })
            .lean<Array<{ _id: unknown; providerId: string; date: string; time: string }>>();

        const messages = retireConsumedProposalMessages(
            conversation.messages,
            conversation.consumedProposal,
        );

        return NextResponse.json({
            conversationId: conversation._id,
            messages,
            consumedProposal: conversation.consumedProposal ?? null,
            scheduledAppointments,
        });
    } catch (error) {
        console.error("Error fetching conversation:", error);
        return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const conversationId = new URL(req.url).searchParams.get('conversationId');
    if (!conversationId) return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    await connectDB();
    const deleted = await Conversation.deleteOne({ _id: conversationId, userId, kind: 'appointment' });
    if (!deleted.deletedCount) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
        conversationId?: string;
        kind?: "booking" | "reschedule";
        providerId?: string;
        date?: string;
        time?: string;
        summary?: string;
    };
    if (!body.conversationId || !body.summary?.trim() || !body.providerId || !body.date || !body.time) {
        return NextResponse.json({ error: "A completed booking summary is required" }, { status: 400 });
    }

    await connectDB();
    const conversation = await Conversation.findOne({
        _id: body.conversationId,
        userId,
        kind: "appointment",
    });
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const summary = body.summary.trim();
    conversation.messages = retireConsumedProposalMessages(conversation.messages, {
        providerId: body.providerId,
        date: body.date,
        time: body.time,
        summary,
    }) as typeof conversation.messages;
    conversation.consumedProposal = {
        kind: body.kind === "reschedule" ? "reschedule" : "booking",
        providerId: body.providerId,
        date: body.date,
        time: body.time,
        summary,
        consumedAt: new Date(),
    };
    await conversation.save();

    return NextResponse.json({
        success: true,
        conversationId: conversation._id,
        messages: conversation.messages,
        consumedProposal: conversation.consumedProposal,
    });
}
