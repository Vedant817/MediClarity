import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";

export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    try {
        const reports = await Report.find({ userId }).sort({ createdAt: -1 });
        return NextResponse.json({ reports });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }
}

export async function POST() {
    return GET();
}
