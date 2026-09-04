import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Conversation from "@/models/conversation";
import { auth } from "@clerk/nextjs/server";

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
                userId 
            });
        } else {
            // Fetch latest conversation for user
            conversation = await Conversation.findOne({ userId })
                .sort({ createdAt: -1 });
        }

        if (!conversation) {
            return NextResponse.json({ messages: [] });
        }

        return NextResponse.json({
            conversationId: conversation._id,
            messages: conversation.messages
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
